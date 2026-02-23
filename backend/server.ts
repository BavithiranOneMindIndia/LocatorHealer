import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { extractLocatorRegistry, transformScriptToSmartCalls } from './locatorParser.js';
import { logAudit } from './logger.js';
import { SmartRunner } from './smartRunner.js';
import { readJson, writeJson } from './storage.js';
import type { HealProposal, LocatorRegistry, ProjectConfig } from './types.js';

const app = express();
app.use(cors());
app.use(express.json());

const configPath = path.resolve('config/project.json');
const workflowPath = path.resolve('scripts/workflow.spec.ts');
const registryPath = path.resolve('locators/registry.json');
const proposalPath = path.resolve('locators/proposed_changes.json');

let codegenProcess: ChildProcessWithoutNullStreams | null = null;

app.get('/api/state', async (_req, res) => {
  const config = await readJson<ProjectConfig | null>(configPath, null);
  const registry = await readJson<LocatorRegistry>(registryPath, {});
  const proposals = await readJson<HealProposal[]>(proposalPath, []);
  res.json({ config, registry, proposals, recording: Boolean(codegenProcess) });
});

app.post('/api/config', async (req, res) => {
  const payload = req.body as ProjectConfig;
  await writeJson(configPath, payload);
  res.json({ ok: true });
});

app.post('/api/record/start', async (_req, res) => {
  if (codegenProcess) return res.status(409).json({ error: 'Recording already running' });
  const config = await readJson<ProjectConfig | null>(configPath, null);
  if (!config) return res.status(400).json({ error: 'Missing project config' });

  codegenProcess = spawn('npx', ['playwright', 'codegen', config.baseUrl, '-o', workflowPath], {
    stdio: 'pipe'
  });

  codegenProcess.on('exit', () => {
    codegenProcess = null;
  });

  res.json({ ok: true, message: 'Codegen started. Close browser when done then click stop.' });
});

app.post('/api/record/stop', async (_req, res) => {
  if (!codegenProcess) return res.status(400).json({ error: 'No active recording' });
  codegenProcess.kill('SIGINT');
  codegenProcess = null;

  const scriptContents = await readFile(workflowPath, 'utf-8');
  const registry = extractLocatorRegistry(scriptContents);
  const smartified = transformScriptToSmartCalls(scriptContents);
  const wrapper = `${smartified}\n\nexport async function runWorkflow(smart: any) {\n  // Ensure your steps call smart.click(...).\n}\n`;

  await writeFile(workflowPath, wrapper, 'utf-8');
  await writeJson(registryPath, registry);

  res.json({ ok: true, registrySize: Object.keys(registry).length });
});

app.post('/api/run', async (_req, res) => {
  const config = await readJson<ProjectConfig | null>(configPath, null);
  if (!config) return res.status(400).json({ error: 'Missing config' });

  const smart = new SmartRunner(config);
  await smart.init();

  try {
    await smart.gotoBase();
    const moduleUrl = `${pathToFileURL(workflowPath).href}?t=${Date.now()}`;
    const workflowModule = await import(moduleUrl);
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

app.post('/api/heal', async (_req, res) => {
  const proposals = await readJson<HealProposal[]>(proposalPath, []);
  logAudit('heal.scan', { proposals: proposals.length });
  res.json({ ok: true, proposals });
});

app.post('/api/approve', async (req, res) => {
  const { elementKey, approved } = req.body as { elementKey: string; approved: boolean };
  const config = await readJson<ProjectConfig | null>(configPath, null);
  if (!config) return res.status(400).json({ error: 'Missing config' });

  const smart = new SmartRunner(config);
  await smart.init();
  await smart.applyApproval(elementKey, approved);
  await smart.close();

  res.json({ ok: true });
});

app.get('/api/registry', async (_req, res) => {
  const registry = await readJson<LocatorRegistry>(registryPath, {});
  res.json(registry);
});

app.listen(3001, () => {
  console.log('Backend running on http://localhost:3001');
});
