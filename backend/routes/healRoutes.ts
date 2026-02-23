import { Router } from 'express';
import path from 'node:path';
import { chromium } from 'playwright';
import type { LocatorRegistry, ProjectConfig } from '../types.js';
import { addProposal, getProposals, getRegistry } from '../core/locatorRegistry.js';
import { healLocator, toLocator } from '../core/healingEngine.js';
import { readJson } from '../utils/fileManager.js';

const router = Router();
const configPath = path.resolve('config/project.json');

router.get('/registry', async (_req, res) => {
  res.json(await getRegistry());
});

router.get('/proposals', async (_req, res) => {
  res.json(await getProposals());
});

router.post('/scan', async (_req, res) => {
  const config = await readJson<ProjectConfig | null>(configPath, null);
  if (!config) return res.status(400).json({ error: 'Missing config' });

  const registry = await getRegistry();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(
    config.authMode === 'auth' ? { storageState: config.storageStatePath } : {}
  );
  const page = await context.newPage();

  let healed = 0;
  const checked: string[] = [];

  try {
    await page.goto(config.baseUrl, { waitUntil: 'domcontentloaded' });

    for (const [key, entry] of Object.entries(registry as LocatorRegistry)) {
      checked.push(key);
      const visible = await toLocator(page, entry.primary).first().isVisible().catch(() => false);
      if (visible) continue;

      const proposal = await healLocator(page, key, entry);
      if (proposal) {
        await addProposal(proposal);
        healed += 1;
      }
    }

    const proposals = await getProposals();
    res.json({ ok: true, checked: checked.length, healed, proposals });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message, checked: checked.length, healed });
  } finally {
    await context.close();
    await browser.close();
  }
});

export default router;
