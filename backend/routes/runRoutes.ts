import { Router } from 'express';
import path from 'node:path';
import { readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import type { ProjectConfig } from '../types.js';
import { SmartRunner } from '../core/smartRunner.js';
import { readJson } from '../utils/fileManager.js';

const router = Router();
const configPath = path.resolve('config/project.json');
const scriptsDir = path.resolve('scripts');
const defaultWorkflowPath = path.resolve('scripts/workflow.spec.ts');

router.get('/workflows', async (_req, res) => {
  const files = await readdir(scriptsDir).catch(() => []);
  const workflows = files.filter((f) => f.endsWith('.spec.ts'));
  res.json({ workflows });
});

router.post('/', async (req, res) => {
  const config = await readJson<ProjectConfig | null>(configPath, null);
  if (!config) return res.status(400).json({ error: 'Missing config' });

  const workflowName = typeof req.body?.workflow === 'string' ? req.body.workflow : 'workflow.spec.ts';
  const workflowPath = path.resolve('scripts', workflowName);

  const smart = new SmartRunner(config);
  await smart.init();

  try {
    await smart.gotoBase();
    const selectedPath = workflowName.endsWith('.spec.ts') ? workflowPath : defaultWorkflowPath;
    const workflowModule = await import(`${pathToFileURL(selectedPath).href}?t=${Date.now()}`);
    if (typeof workflowModule.runWorkflow === 'function') {
      await workflowModule.runWorkflow(smart);
    }
    await smart.close();
    res.json({ ok: true, workflow: path.basename(selectedPath), message: 'Workflow completed successfully.' });
  } catch (error) {
    await smart.close();
    res.status(500).json({ error: (error as Error).message, workflow: workflowName });
  }
});

export default router;
