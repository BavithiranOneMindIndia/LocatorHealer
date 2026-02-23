import { Router } from 'express';
import path from 'node:path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import type { ProjectConfig } from '../types.js';
import { extractLocatorRegistry, transformScriptToSmartCalls } from '../core/locatorParser.js';
import { saveRegistry } from '../core/locatorRegistry.js';
import { readJson } from '../utils/fileManager.js';
import { logAudit } from '../utils/logger.js';

const router = Router();
const configPath = path.resolve('config/project.json');
const workflowPath = path.resolve('scripts/workflow.spec.ts');

let codegenProcess: ChildProcessWithoutNullStreams | null = null;

function getCodegenArgs(baseUrl: string): string[] {
  return [path.resolve('node_modules/playwright/cli.js'), 'codegen', baseUrl, '-o', workflowPath];
}

router.get('/status', (_req, res) => {
  res.json({ recording: Boolean(codegenProcess) });
});

router.post('/start', async (_req, res) => {
  if (codegenProcess) return res.status(409).json({ error: 'Recording already running' });

  const config = await readJson<ProjectConfig | null>(configPath, null);
  if (!config) return res.status(400).json({ error: 'Missing project config' });

  codegenProcess = spawn(process.execPath, getCodegenArgs(config.baseUrl), { stdio: 'pipe' });
  codegenProcess.on('error', (error) => {
    logAudit('record.spawn.error', { message: error.message });
    codegenProcess = null;
  });
  codegenProcess.on('exit', () => {
    codegenProcess = null;
  });

  res.json({ ok: true, message: 'Recording started. Close Playwright codegen window and click Stop Recording.' });
});

router.post('/stop', async (_req, res) => {
  if (!codegenProcess) return res.status(400).json({ error: 'No active recording' });

  codegenProcess.kill('SIGINT');
  codegenProcess = null;

  const script = await readFile(workflowPath, 'utf-8');
  const registry = extractLocatorRegistry(script);
  await saveRegistry(registry);

  const smartified = transformScriptToSmartCalls(script);
  const wrapped = `${smartified}\n\nexport async function runWorkflow(smart: any) {\n  // Move generated steps here with smart.click('key').\n}\n`;
  await writeFile(workflowPath, wrapped, 'utf-8');

  res.json({ ok: true, registrySize: Object.keys(registry).length });
});

export default router;
