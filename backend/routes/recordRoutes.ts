import { Router } from 'express';
import path from 'node:path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { extractLocatorRegistry, extractSmartActionLines } from '../core/locatorParser.js';
import { saveRegistry } from '../core/locatorRegistry.js';
import { logAudit } from '../utils/logger.js';
import { pushActivity } from '../utils/activityStore.js';
import { getActiveProjectId, projectPaths, readProjectConfig } from '../utils/projectStore.js';

const router = Router();
let currentWorkflowName = 'workflow.spec.ts';
let currentProjectId = '';
let codegenProcess: ChildProcessWithoutNullStreams | null = null;

function workflowPath(projectId: string, name: string): string {
  return path.join(projectPaths(projectId).scriptsDir, name.endsWith('.spec.ts') ? name : `${name}.spec.ts`);
}

function getCodegenArgs(baseUrl: string, wfPath: string): string[] {
  return [path.resolve('node_modules/playwright/cli.js'), 'codegen', baseUrl, '-o', wfPath];
}

router.get('/status', (_req, res) => {
  res.json({ recording: Boolean(codegenProcess), workflow: currentWorkflowName, projectId: currentProjectId || null });
});

router.post('/start', async (req, res) => {
  if (codegenProcess) return res.status(409).json({ error: 'Recording already running' });

  const projectId = (typeof req.body?.projectId === 'string' ? req.body.projectId : '') || await getActiveProjectId();
  if (!projectId) return res.status(400).json({ error: 'No active project selected' });

  const config = await readProjectConfig(projectId);
  if (!config) return res.status(400).json({ error: 'Missing project config' });

  currentProjectId = projectId;
  currentWorkflowName = typeof req.body?.workflow === 'string' && req.body.workflow.trim()
    ? (req.body.workflow.endsWith('.spec.ts') ? req.body.workflow : `${req.body.workflow}.spec.ts`)
    : 'workflow.spec.ts';

  const wfPath = workflowPath(projectId, currentWorkflowName);
  codegenProcess = spawn(process.execPath, getCodegenArgs(config.baseUrl, wfPath), { stdio: 'pipe' });
  codegenProcess.on('error', (error) => {
    logAudit('record.spawn.error', { message: error.message });
    pushActivity({ ts: new Date().toISOString(), scope: 'record', message: 'Recording spawn error', details: { projectId, error: error.message } });
    codegenProcess = null;
  });
  codegenProcess.on('exit', () => {
    codegenProcess = null;
  });

  pushActivity({ ts: new Date().toISOString(), scope: 'record', message: 'Recording started', details: { workflow: currentWorkflowName, projectId } });
  res.json({ ok: true, workflow: currentWorkflowName, message: 'Recording started. Close Playwright codegen window and click Stop Recording.' });
});

router.post('/stop', async (_req, res) => {
  if (!codegenProcess || !currentProjectId) return res.status(400).json({ error: 'No active recording' });

  codegenProcess.kill('SIGINT');
  codegenProcess = null;

  const filePath = workflowPath(currentProjectId, currentWorkflowName);
  const script = await readFile(filePath, 'utf-8');
  const registry = extractLocatorRegistry(script);
  await saveRegistry(currentProjectId, registry);

  const actionLines = extractSmartActionLines(script, registry);
  const wrapped = `import type { SmartRunner } from '../../../backend/core/smartRunner.js';\n\nexport async function runWorkflow(smart: SmartRunner): Promise<void> {\n${actionLines.map((l) => `  ${l}`).join('\n')}\n}\n`;
  await writeFile(filePath, wrapped, 'utf-8');

  pushActivity({
    ts: new Date().toISOString(),
    scope: 'record',
    message: 'Recording stopped and workflow normalized',
    details: { projectId: currentProjectId, workflow: currentWorkflowName, actionSteps: actionLines.length, registrySize: Object.keys(registry).length }
  });

  res.json({ ok: true, workflow: currentWorkflowName, actionSteps: actionLines.length, registrySize: Object.keys(registry).length });
});

export default router;
