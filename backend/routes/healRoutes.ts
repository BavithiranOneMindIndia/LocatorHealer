import { Router } from 'express';
import { chromium } from 'playwright';
import type { LocatorRegistry } from '../types.js';
import { addProposal, getProposals, getRegistry } from '../core/locatorRegistry.js';
import { healLocator, toLocator } from '../core/healingEngine.js';
import { pushActivity } from '../utils/activityStore.js';
import { getActiveProjectId, readProjectConfig } from '../utils/projectStore.js';

const router = Router();

async function resolveProjectId(raw?: string): Promise<string | null> {
  return raw || await getActiveProjectId();
}

router.get('/registry', async (req, res) => {
  const projectId = await resolveProjectId(typeof req.query.projectId === 'string' ? req.query.projectId : undefined);
  if (!projectId) return res.status(400).json({ error: 'No active project selected' });
  res.json(await getRegistry(projectId));
});

router.get('/proposals', async (req, res) => {
  const projectId = await resolveProjectId(typeof req.query.projectId === 'string' ? req.query.projectId : undefined);
  if (!projectId) return res.status(400).json({ error: 'No active project selected' });
  res.json(await getProposals(projectId));
});

router.post('/scan', async (req, res) => {
  const projectId = await resolveProjectId(typeof req.body?.projectId === 'string' ? req.body.projectId : undefined);
  if (!projectId) return res.status(400).json({ error: 'No active project selected' });

  const config = await readProjectConfig(projectId);
  if (!config) return res.status(400).json({ error: 'Missing config' });

  const registry = await getRegistry(projectId);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(
    config.authMode === 'auth' ? { storageState: config.storageStatePath } : {}
  );
  const page = await context.newPage();

  let healed = 0;
  const details: Array<{ key: string; status: 'healthy' | 'broken' | 'proposed'; similarity?: number }> = [];

  try {
    await page.goto(config.baseUrl, { waitUntil: 'domcontentloaded' });
    pushActivity({ ts: new Date().toISOString(), scope: 'heal', message: 'Heal scan started', details: { projectId } });

    for (const [key, entry] of Object.entries(registry as LocatorRegistry)) {
      const visible = await toLocator(page, entry.primary).first().isVisible().catch(() => false);
      if (visible) {
        details.push({ key, status: 'healthy' });
        continue;
      }

      details.push({ key, status: 'broken' });
      const proposal = await healLocator(page, key, entry);
      if (proposal) {
        await addProposal(projectId, proposal);
        healed += 1;
        details.push({ key, status: 'proposed', similarity: proposal.similarity });
      }
    }

    const proposals = await getProposals(projectId);
    pushActivity({ ts: new Date().toISOString(), scope: 'heal', message: 'Heal scan completed', details: { projectId, checked: details.length, healed } });
    res.json({ ok: true, checked: Object.keys(registry).length, healed, details, proposals, backendActions: ['loadRegistry', 'validateLocator', 'healBroken', 'saveProposals'] });
  } catch (error) {
    pushActivity({ ts: new Date().toISOString(), scope: 'heal', message: 'Heal scan failed', details: { projectId, error: (error as Error).message } });
    res.status(500).json({ error: (error as Error).message, checked: details.length, healed, details });
  } finally {
    await context.close();
    await browser.close();
  }
});

export default router;
