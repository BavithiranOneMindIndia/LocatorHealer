import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { HealProposal, LocatorRegistry, ProjectConfig } from '../types.js';
import { addProposal, approveProposal, getRegistry } from './locatorRegistry.js';
import { healLocator, toLocator } from './healingEngine.js';

export class SmartRunner {
  private browser!: Browser;
  private context!: BrowserContext;
  public page!: Page;
  private registry: LocatorRegistry = {};

  constructor(private readonly config: ProjectConfig, private readonly projectId: string) {}

  async init(): Promise<void> {
    this.browser = await chromium.launch({ headless: true });
    this.context = await this.browser.newContext(
      this.config.authMode === 'auth' ? { storageState: this.config.storageStatePath } : {}
    );
    this.page = await this.context.newPage();
    this.registry = await getRegistry(this.projectId);
  }

  async gotoBase(): Promise<void> {
    try {
      await this.page.goto(this.config.baseUrl, { waitUntil: 'domcontentloaded' });
    } catch {
      const root = new URL(this.config.baseUrl).origin;
      try {
        await this.page.goto(root, { waitUntil: 'domcontentloaded' });
      } catch {
        const navProposal: HealProposal = {
          elementKey: 'navigation',
          oldLocator: this.config.baseUrl,
          proposedLocator: root,
          similarity: 0.72,
          risk: 'MEDIUM',
          validated: false,
          approved: false,
          reason: 'Navigation failed on configured base URL'
        };
        await addProposal(this.projectId, navProposal);
        throw new Error('Navigation failed; proposal created for base URL heal.');
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

      await addProposal(this.projectId, proposal);

      if (this.config.mode === 'dev' && proposal.risk === 'LOW' && proposal.validated) {
        await approveProposal(this.projectId, key, true);
        await toLocator(this.page, proposal.proposedLocator).click();
      } else {
        throw new Error(`Locator broken: healing proposal created for ${key}. Manual approval required.`);
      }
    }
  }

  async fill(key: string, value: string): Promise<void> {
    const entry = this.registry[key];
    if (!entry) throw new Error(`Unknown locator key: ${key}`);

    try {
      await toLocator(this.page, entry.primary).fill(value, { timeout: 2500 });
    } catch {
      const proposal = await healLocator(this.page, key, entry);
      if (!proposal) throw new Error(`Healing failed for ${key}`);
      await addProposal(this.projectId, proposal);
      throw new Error(`Locator broken: healing proposal created for ${key}. Manual approval required.`);
    }
  }

  async press(key: string, value: string): Promise<void> {
    const entry = this.registry[key];
    if (!entry) throw new Error(`Unknown locator key: ${key}`);

    try {
      await toLocator(this.page, entry.primary).press(value, { timeout: 2500 });
    } catch {
      const proposal = await healLocator(this.page, key, entry);
      if (!proposal) throw new Error(`Healing failed for ${key}`);
      await addProposal(this.projectId, proposal);
      throw new Error(`Locator broken: healing proposal created for ${key}. Manual approval required.`);
    }
  }

  async applyApproval(elementKey: string, approved: boolean): Promise<void> {
    await approveProposal(this.projectId, elementKey, approved);
  }

  async close(): Promise<void> {
    await this.context?.close();
    await this.browser?.close();
  }
}
