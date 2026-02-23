import { Router } from 'express';
import path from 'node:path';
import { chromium } from 'playwright';
import type { LocatorRegistry, ProjectConfig } from '../types.js';
import { addProposal, getProposals, getRegistry } from '../core/locatorRegistry.js';
import { healLocator, toLocator } from '../core/healingEngine.js';
import { readJson } from '../utils/fileManager.js';
import { pushActivity } from '../utils/activityStore.js';

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
  const details: Array<{ key: string; status: 'healthy' | 'broken' | 'proposed'; similarity?: number }> = [];

  try {
    await page.goto(config.baseUrl, { waitUntil: 'domcontentloaded' });
    pushActivity({ ts: new Date().toISOString(), scope: 'heal', message: 'Heal scan started' });

    for (const [key, entry] of Object.entries(registry as LocatorRegistry)) {
      const visible = await toLocator(page, entry.primary).first().isVisible().catch(() => false);
      if (visible) {
        details.push({ key, status: 'healthy' });
        continue;
      }

      details.push({ key, status: 'broken' });
      const proposal = await healLocator(page, key, entry);
      if (proposal) {
        await addProposal(proposal);
        healed += 1;
        details.push({ key, status: 'proposed', similarity: proposal.similarity });
      }
    }

    const proposals = await getProposals();
    pushActivity({ ts: new Date().toISOString(), scope: 'heal', message: 'Heal scan completed', details: { checked: details.length, healed } });
    res.json({ ok: true, checked: Object.keys(registry).length, healed, details, proposals, backendActions: ['loadRegistry', 'validateLocator', 'healBroken', 'saveProposals'] });
  } catch (error) {
    pushActivity({ ts: new Date().toISOString(), scope: 'heal', message: 'Heal scan failed', details: { error: (error as Error).message } });
    res.status(500).json({ error: (error as Error).message, checked: details.length, healed, details });
  } finally {
    await context.close();
    await browser.close();
  }
});

export default router;
