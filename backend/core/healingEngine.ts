import type { Page } from 'playwright';
import type { DOMCandidate, HealProposal, LocatorEntry } from '../types.js';
import { logAudit } from '../utils/logger.js';
import { collectDOMCandidates } from './domAnalyzer.js';
import { computeSimilarity } from './similarityEngine.js';
import { classifyRisk } from './riskClassifier.js';

const THRESHOLD = 0.75;

function toLocator(page: Page, locatorExpr: string) {
  if (locatorExpr.startsWith('getByRole')) {
    const role = locatorExpr.match(/getByRole\('([^']+)'/)?.[1] ?? 'button';
    const name = locatorExpr.match(/name:\s*'([^']+)'/)?.[1];
    return name ? page.getByRole(role as never, { name }) : page.getByRole(role as never);
  }
  if (locatorExpr.startsWith('getByLabel')) {
    const label = locatorExpr.match(/getByLabel\('([^']+)'/)?.[1] ?? '';
    return page.getByLabel(label);
  }
  if (locatorExpr.startsWith('getByText')) {
    const text = locatorExpr.match(/getByText\('([^']+)'/)?.[1] ?? '';
    return page.getByText(text);
  }
  const body = locatorExpr.match(/locator\('(.+)'\)/)?.[1] ?? 'body';
  return page.locator(body);
}

function buildLocator(candidate: DOMCandidate): string {
  if (candidate.role && candidate.ariaLabel) {
    return `getByRole('${candidate.role}', { name: '${candidate.ariaLabel}' })`;
  }
  if (candidate.ariaLabel) return `locator('[aria-label="${candidate.ariaLabel}"]')`;
  if (candidate.text) return `getByText('${candidate.text}')`;
  if (candidate.testId) return `locator('[data-testid="${candidate.testId}"]')`;
  if (candidate.id) return `locator('#${candidate.id}')`;
  return `locator('${candidate.tag}')`;
}

async function validateCandidate(page: Page, locatorExpr: string): Promise<boolean> {
  const loc = toLocator(page, locatorExpr);
  const visible = await loc.first().isVisible().catch(() => false);
  const enabled = await loc.first().isEnabled().catch(() => false);
  return visible && enabled;
}

export async function healLocator(page: Page, elementKey: string, entry: LocatorEntry): Promise<HealProposal | null> {
  await page.content();
  const candidates = await collectDOMCandidates(page);

  const scored = candidates.map((candidate) => ({
    candidate,
    similarity: computeSimilarity(entry.metadata, candidate)
  }));

  scored.sort((a, b) => b.similarity - a.similarity);
  const best = scored[0];
  if (!best || best.similarity < THRESHOLD) {
    logAudit('heal.failed', { elementKey, reason: 'No candidate passed threshold' });
    return null;
  }

  const proposedLocator = buildLocator(best.candidate);
  const validated = await validateCandidate(page, proposedLocator);
  const multipleCloseMatches = scored.filter((s) => s.similarity >= best.similarity - 0.04).length > 1;

  const proposal: HealProposal = {
    elementKey,
    oldLocator: entry.primary,
    proposedLocator,
    similarity: Number(best.similarity.toFixed(2)),
    risk: classifyRisk(best.similarity, multipleCloseMatches, validated),
    validated,
    approved: false
  };

  logAudit('heal.proposed', proposal as unknown as Record<string, unknown>);
  return proposal;
}

export { toLocator };
