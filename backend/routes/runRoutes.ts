import { Router } from 'express';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { extractLocatorRegistry, extractSmartActionLines } from '../core/locatorParser.js';
import { saveRegistry } from '../core/locatorRegistry.js';
import { SmartRunner } from '../core/smartRunner.js';
import { pushActivity } from '../utils/activityStore.js';
import { getActiveProjectId, projectPaths, readProjectConfig } from '../utils/projectStore.js';

const router = Router();

async function resolveProjectId(raw?: string): Promise<string | null> {
  return raw || await getActiveProjectId();
}

async function normalizeRecordedWorkflowIfNeeded(projectId: string, workflowPath: string): Promise<{ normalized: boolean; actionSteps: number }> {
  const script = await readFile(workflowPath, 'utf-8');
  const looksLikeRecordedCodegenScript = script.includes('page.') && !script.includes('smart.click(');
  if (!looksLikeRecordedCodegenScript) return { normalized: false, actionSteps: 0 };

  const registry = extractLocatorRegistry(script);
  await saveRegistry(projectId, registry);
  const extracted = extractSmartActionLines(script, registry);
  const actionLines = Array.isArray(extracted) ? extracted : [];

  if (actionLines.length === 0) {
    throw new Error('Workflow normalization produced 0 executable steps. Please re-record this workflow.');
  }

  const wrapped = `import type { SmartRunner } from '../../../backend/core/smartRunner.js';\n\nexport async function runWorkflow(smart: SmartRunner): Promise<void> {\n${actionLines.map((line) => `  ${line}`).join('\n')}\n}\n`;
  await writeFile(workflowPath, wrapped, 'utf-8');
  return { normalized: true, actionSteps: actionLines.length };
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

    const normalization = await normalizeRecordedWorkflowIfNeeded(projectId, workflowPath);
    if (normalization.normalized) {
      pushActivity({
        ts: new Date().toISOString(),
        scope: 'run',
        message: 'Workflow auto-normalized before run',
        details: { workflow: path.basename(workflowPath), projectId, actionSteps: normalization.actionSteps }
      });
    }

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
