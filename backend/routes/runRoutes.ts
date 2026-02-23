import { Router } from 'express';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SmartRunner } from '../core/smartRunner.js';
import { pushActivity } from '../utils/activityStore.js';
import { getActiveProjectId, projectPaths, readProjectConfig } from '../utils/projectStore.js';

const router = Router();

async function resolveProjectId(raw?: string): Promise<string | null> {
  return raw || await getActiveProjectId();
}

router.get('/workflows', async (req, res) => {
  const projectId = await resolveProjectId(typeof req.query.projectId === 'string' ? req.query.projectId : undefined);
  if (!projectId) return res.status(400).json({ error: 'No active project selected' });

  const files = await readdir(projectPaths(projectId).scriptsDir).catch(() => []);
  const workflows = files.filter((f) => f.endsWith('.spec.ts'));
  res.json({ workflows });
});

router.post('/', async (req, res) => {
  const projectId = await resolveProjectId(typeof req.body?.projectId === 'string' ? req.body.projectId : undefined);
  if (!projectId) return res.status(400).json({ error: 'No active project selected' });

  const config = await readProjectConfig(projectId);
  if (!config) return res.status(400).json({ error: 'Missing project config' });

  const workflowName = typeof req.body?.workflow === 'string' ? req.body.workflow : 'workflow.spec.ts';
  const workflowPath = path.join(projectPaths(projectId).scriptsDir, workflowName);

  const smart = new SmartRunner(config, projectId);
  await smart.init();

  try {
    await smart.gotoBase();
    pushActivity({ ts: new Date().toISOString(), scope: 'run', message: 'Run started', details: { workflow: path.basename(workflowPath), projectId } });

    const workflowModule = await import(`${pathToFileURL(workflowPath).href}?t=${Date.now()}`);
    if (typeof workflowModule.runWorkflow === 'function') {
      await workflowModule.runWorkflow(smart);
    }

    await smart.close();
    pushActivity({ ts: new Date().toISOString(), scope: 'run', message: 'Run completed', details: { workflow: path.basename(workflowPath), projectId } });
    res.json({ ok: true, workflow: path.basename(workflowPath), message: 'Workflow completed successfully.', backendActions: ['gotoBase', 'runWorkflow', 'close'] });
  } catch (error) {
    await smart.close();
    pushActivity({ ts: new Date().toISOString(), scope: 'run', message: 'Run failed', details: { workflow: workflowName, projectId, error: (error as Error).message } });
    res.status(500).json({ error: (error as Error).message, workflow: workflowName, backendActions: ['gotoBase', 'runWorkflow', 'error'] });
  }
});

export default router;
