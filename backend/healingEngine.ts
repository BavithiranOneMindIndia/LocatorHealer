import type { Page } from 'playwright';
import type { HealProposal, LocatorEntry } from './types.js';
import { logAudit } from './logger.js';

interface Candidate {
  tag: string;
  text: string;
  role: string;
  label: string;
  testId: string;
  id: string;
  className: string;
  ariaLabel: string;
  index: number;
}

function textScore(a: string, b: string): number {
  if (!a || !b) return 0;
  const aa = a.toLowerCase();
  const bb = b.toLowerCase();
  if (aa === bb) return 1;
  if (aa.includes(bb) || bb.includes(aa)) return 0.8;
  const aSet = new Set(aa.split(/\s+/));
  const bSet = new Set(bb.split(/\s+/));
  const intersect = [...aSet].filter((t) => bSet.has(t)).length;
  return intersect / Math.max(aSet.size, bSet.size, 1);
}

function getRisk(score: number): HealProposal['risk'] {
  if (score >= 0.88) return 'LOW';
  if (score >= 0.75) return 'MEDIUM';
  return 'HIGH';
}

function buildLocator(c: Candidate): string {
  if (c.role && c.text) return `getByRole('${c.role}', { name: '${c.text}' })`;
  if (c.label) return `getByLabel('${c.label}')`;
  if (c.text) return `getByText('${c.text}')`;
  if (c.testId) return `locator('[data-testid="${c.testId}"]')`;
  if (c.id) return `locator('#${c.id}')`;
  if (c.className) return `locator('${c.tag}.${c.className.split(' ')[0]}')`;
  return `locator('xpath=(//${c.tag})[${c.index + 1}]')`;
}

async function collectCandidates(page: Page): Promise<Candidate[]> {
  return page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('body *'));
    return nodes.map((el, index) => ({
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || el.textContent || '').trim().slice(0, 120),
      role: el.getAttribute('role') || '',
      label: el.getAttribute('aria-label') || '',
      testId: el.getAttribute('data-testid') || '',
      id: el.id || '',
      className: el.className || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      index
    }));
  });
}

async function validateLocator(page: Page, locatorExpr: string): Promise<boolean> {
  const locator = toLocator(page, locatorExpr);
  return locator.isVisible().catch(() => false);
}

export function toLocator(page: Page, locatorExpr: string) {
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

export async function healLocator(page: Page, elementKey: string, old: LocatorEntry): Promise<HealProposal | null> {
  await page.content();
  const candidates = await collectCandidates(page);

  const scored = candidates.map((c) => {
    const tagMatch = old.metadata.tag && c.tag === old.metadata.tag ? 0.2 : 0;
    const roleMatch = old.metadata.role && c.role === old.metadata.role ? 0.2 : 0;
    const textMatch = old.metadata.text ? textScore(old.metadata.text, c.text) * 0.35 : 0;
    const labelMatch = old.metadata.label ? textScore(old.metadata.label, c.label) * 0.15 : 0;
    const attrMatch = old.metadata.attrs && c.testId && old.metadata.attrs['data-testid'] === c.testId ? 0.1 : 0;
    const proximity = Math.max(0, 0.1 - c.index / 5000);
    return { c, score: tagMatch + roleMatch + textMatch + labelMatch + attrMatch + proximity };
  });

  const best = scored.sort((a, b) => b.score - a.score)[0];
  if (!best || best.score < 0.7) {
    logAudit('heal.failed', { elementKey, reason: 'No candidate above threshold' });
    return null;
  }

  const proposedLocator = buildLocator(best.c);
  const validated = await validateLocator(page, proposedLocator);

  const proposal: HealProposal = {
    elementKey,
    oldLocator: old.primary,
    proposedLocator,
    similarity: Number(best.score.toFixed(2)),
    risk: getRisk(best.score),
    validated,
    approved: false
  };

  logAudit('heal.proposed', proposal as unknown as Record<string, unknown>);
  return proposal;
}
