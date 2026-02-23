import { Router } from 'express';
import path from 'node:path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import type { ProjectConfig } from '../types.js';
import { extractLocatorRegistry, extractSmartClickLines } from '../core/locatorParser.js';
import { saveRegistry } from '../core/locatorRegistry.js';
import { readJson } from '../utils/fileManager.js';
import { logAudit } from '../utils/logger.js';
import { pushActivity } from '../utils/activityStore.js';

const router = Router();
const configPath = path.resolve('config/project.json');
let currentWorkflowName = 'workflow.spec.ts';

let codegenProcess: ChildProcessWithoutNullStreams | null = null;

function workflowPath(name: string): string {
  return path.resolve('scripts', name.endsWith('.spec.ts') ? name : `${name}.spec.ts`);
}

function getCodegenArgs(baseUrl: string, wf: string): string[] {
  return [path.resolve('node_modules/playwright/cli.js'), 'codegen', baseUrl, '-o', workflowPath(wf)];
}

router.get('/status', (_req, res) => {
  res.json({ recording: Boolean(codegenProcess), workflow: currentWorkflowName });
});

router.post('/start', async (req, res) => {
  if (codegenProcess) return res.status(409).json({ error: 'Recording already running' });

  const config = await readJson<ProjectConfig | null>(configPath, null);
  if (!config) return res.status(400).json({ error: 'Missing project config' });

  currentWorkflowName = typeof req.body?.workflow === 'string' && req.body.workflow.trim()
    ? (req.body.workflow.endsWith('.spec.ts') ? req.body.workflow : `${req.body.workflow}.spec.ts`)
    : 'workflow.spec.ts';

  codegenProcess = spawn(process.execPath, getCodegenArgs(config.baseUrl, currentWorkflowName), { stdio: 'pipe' });
  codegenProcess.on('error', (error) => {
    logAudit('record.spawn.error', { message: error.message });
    pushActivity({ ts: new Date().toISOString(), scope: 'record', message: 'Recording spawn error', details: { error: error.message } });
    codegenProcess = null;
  });
  codegenProcess.on('exit', () => {
    codegenProcess = null;
  });

  pushActivity({ ts: new Date().toISOString(), scope: 'record', message: 'Recording started', details: { workflow: currentWorkflowName } });
  res.json({ ok: true, workflow: currentWorkflowName, message: 'Recording started. Close Playwright codegen window and click Stop Recording.' });
});

router.post('/stop', async (_req, res) => {
  if (!codegenProcess) return res.status(400).json({ error: 'No active recording' });

  codegenProcess.kill('SIGINT');
  codegenProcess = null;

  const filePath = workflowPath(currentWorkflowName);
  const script = await readFile(filePath, 'utf-8');
  const registry = extractLocatorRegistry(script);
  await saveRegistry(registry);

  const clickLines = extractSmartClickLines(script);
  const wrapped = `import type { SmartRunner } from '../backend/core/smartRunner.js';\n\nexport async function runWorkflow(smart: SmartRunner): Promise<void> {\n${clickLines.map((l) => `  ${l}`).join('\n')}\n}\n`;
  await writeFile(filePath, wrapped, 'utf-8');

  pushActivity({
    ts: new Date().toISOString(),
    scope: 'record',
    message: 'Recording stopped and workflow normalized',
    details: { workflow: currentWorkflowName, clickSteps: clickLines.length, registrySize: Object.keys(registry).length }
  });

  res.json({ ok: true, workflow: currentWorkflowName, clickSteps: clickLines.length, registrySize: Object.keys(registry).length });
});

export default router;
