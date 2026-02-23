import path from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { healLocator, toLocator } from './healingEngine.js';
import { logAudit } from './logger.js';
import { readJson, writeJson } from './storage.js';
import type { HealProposal, LocatorRegistry, ProjectConfig } from './types.js';

const registryPath = path.resolve('locators/registry.json');
const proposalPath = path.resolve('locators/proposed_changes.json');

export class SmartRunner {
  public page!: Page;
  private context!: BrowserContext;
  private registry: LocatorRegistry = {};

  constructor(private config: ProjectConfig) {}

  async init(): Promise<void> {
    const browser = await chromium.launch({ headless: true });
    this.context = await browser.newContext(
      this.config.authMode === 'auth' ? { storageState: this.config.storageStatePath } : {}
    );
    this.page = await this.context.newPage();
    this.registry = await readJson<LocatorRegistry>(registryPath, {});
  }

  async gotoBase(): Promise<void> {
    try {
      await this.page.goto(this.config.baseUrl, { waitUntil: 'domcontentloaded' });
    } catch {
      const root = new URL(this.config.baseUrl).origin;
      try {
        await this.page.goto(root, { waitUntil: 'domcontentloaded' });
      } catch {
        const proposal: HealProposal = {
          elementKey: 'navigation',
          oldLocator: this.config.baseUrl,
          proposedLocator: root,
          similarity: 0.72,
          risk: 'MEDIUM',
          validated: false,
          approved: false,
          reason: 'Navigation failed for configured URL'
        };
        const proposals = await readJson<HealProposal[]>(proposalPath, []);
        proposals.push(proposal);
        await writeJson(proposalPath, proposals);
        throw new Error('Navigation failed; heal proposal created.');
      }
    }
  }

  async click(key: string): Promise<void> {
    const entry = this.registry[key];
    if (!entry) throw new Error(`Unknown locator key: ${key}`);

    try {
      await toLocator(this.page, entry.primary).click({ timeout: 2500 });
    } catch {
      const proposal = await healLocator(this.page, key, entry);
      if (!proposal) throw new Error(`Healing failed for ${key}`);

      const proposals = await readJson<HealProposal[]>(proposalPath, []);
      proposals.push(proposal);
      await writeJson(proposalPath, proposals);

      if (this.config.mode === 'dev' && proposal.risk === 'LOW' && proposal.validated) {
        await this.applyApproval(proposal.elementKey, true);
        await toLocator(this.page, proposal.proposedLocator).click();
      } else {
        throw new Error(`Healing proposal requires approval for ${key}`);
      }
    }
  }

  async applyApproval(elementKey: string, approved: boolean): Promise<void> {
    const proposals = await readJson<HealProposal[]>(proposalPath, []);
    const idx = proposals.findIndex((p) => p.elementKey === elementKey && !p.approved);
    if (idx < 0) return;

    const proposal = proposals[idx];
    proposal.approved = approved;

    if (approved) {
      const target = this.registry[elementKey];
      if (target) {
        target.history.push(target.primary);
        target.primary = proposal.proposedLocator;
      }
      proposals.splice(idx, 1);
      await writeJson(registryPath, this.registry);
      logAudit('approval.accepted', { elementKey, newLocator: proposal.proposedLocator });
    } else {
      logAudit('approval.rejected', { elementKey, oldLocator: proposal.oldLocator });
    }

    await writeJson(proposalPath, proposals);
  }

  async close(): Promise<void> {
    await this.context?.close();
  }
}
