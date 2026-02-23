import { Router } from 'express';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ProjectConfig } from '../types.js';
import { SmartRunner } from '../core/smartRunner.js';
import { readJson } from '../utils/fileManager.js';

const router = Router();
const configPath = path.resolve('config/project.json');
const workflowPath = path.resolve('scripts/workflow.spec.ts');

router.post('/', async (_req, res) => {
  const config = await readJson<ProjectConfig | null>(configPath, null);
  if (!config) return res.status(400).json({ error: 'Missing config' });

  const smart = new SmartRunner(config);
  await smart.init();

  try {
    await smart.gotoBase();
    const workflowModule = await import(`${pathToFileURL(workflowPath).href}?t=${Date.now()}`);
    if (typeof workflowModule.runWorkflow === 'function') {
      await workflowModule.runWorkflow(smart);
    }
    await smart.close();
    res.json({ ok: true });
  } catch (error) {
    await smart.close();
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
