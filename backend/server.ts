import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { extractLocatorRegistry, transformScriptToSmartCalls } from './locatorParser.js';
import { logAudit } from './logger.js';
import { SmartRunner } from './smartRunner.js';
import { readJson, writeJson } from './storage.js';
import type { AuthConfig, HealProposal, LocatorRegistry, ProjectConfig } from './types.js';

const app = express();
app.use(cors());
app.use(express.json());

const configPath = path.resolve('config/project.json');
const workflowPath = path.resolve('scripts/workflow.spec.ts');
const registryPath = path.resolve('locators/registry.json');
const proposalPath = path.resolve('locators/proposed_changes.json');

let codegenProcess: ChildProcessWithoutNullStreams | null = null;
let authSession: {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  startedAt: number;
} | null = null;

function getPlaywrightCliArgs(baseUrl: string): string[] {
  const cliPath = path.resolve('node_modules/playwright/cli.js');
  return [cliPath, 'codegen', baseUrl, '-o', workflowPath];
}

async function detectAuthSuccess(page: Page, auth?: AuthConfig): Promise<boolean> {
  const successUrlIncludes = auth?.successUrlIncludes?.trim();
  const successSelector = auth?.successSelector?.trim();

  if (successSelector) {
    const visible = await page.locator(successSelector).first().isVisible().catch(() => false);
    if (visible) return true;
  }

  if (successUrlIncludes && page.url().includes(successUrlIncludes)) return true;

  const url = page.url();
  if (url.includes('web.whatsapp.com') && !url.includes('landing')) {
    const qr = await page.locator('canvas[aria-label*="Scan"]').first().isVisible().catch(() => false);
    if (!qr) return true;
  }

  const cookies = await page.context().cookies();
  return cookies.length > 0 && !url.includes('login');
}

async function autoFillAuth(page: Page, auth?: AuthConfig): Promise<void> {
  if (!auth) return;

  if (auth.username && auth.usernameSelector) {
    await page.locator(auth.usernameSelector).first().fill(auth.username).catch(() => undefined);
  }
  if (auth.password && auth.passwordSelector) {
    await page.locator(auth.passwordSelector).first().fill(auth.password).catch(() => undefined);
  }
  if (auth.otp && auth.otpSelector) {
    await page.locator(auth.otpSelector).first().fill(auth.otp).catch(() => undefined);
  }
  if (auth.submitSelector) {
    await page.locator(auth.submitSelector).first().click().catch(() => undefined);
  }
}

app.get('/api/state', async (_req, res) => {
  const config = await readJson<ProjectConfig | null>(configPath, null);
  const registry = await readJson<LocatorRegistry>(registryPath, {});
  const proposals = await readJson<HealProposal[]>(proposalPath, []);
  res.json({
    config,
    registry,
    proposals,
    recording: Boolean(codegenProcess),
    authSessionActive: Boolean(authSession)
  });
});

app.post('/api/config', async (req, res) => {
  const payload = req.body as ProjectConfig;
  await writeJson(configPath, payload);
  res.json({ ok: true });
});

app.post('/api/auth/start', async (_req, res) => {
  const config = await readJson<ProjectConfig | null>(configPath, null);
  if (!config || config.authMode !== 'auth') {
    return res.status(400).json({ error: 'Auth mode is not enabled in project config' });
  }

  if (authSession) {
    return res.status(409).json({ error: 'Auth session already active' });
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  authSession = { browser, context, page, startedAt: Date.now() };

  const loginUrl = config.auth?.loginUrl?.trim() || config.baseUrl;
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
  await autoFillAuth(page, config.auth);

  res.json({
    ok: true,
    message:
      'Auth browser opened. Complete username/password/OTP and/or QR scan. Then click Check Auth Status.',
    authUrl: page.url()
  });
});

app.get('/api/auth/status', async (_req, res) => {
  if (!authSession) {
    return res.json({ ok: true, active: false, authenticated: false, message: 'No active auth session' });
  }

  const config = await readJson<ProjectConfig | null>(configPath, null);
  const authenticated = await detectAuthSuccess(authSession.page, config?.auth);

  res.json({
    ok: true,
    active: true,
    authenticated,
    currentUrl: authSession.page.url(),
    elapsedSec: Math.floor((Date.now() - authSession.startedAt) / 1000),
    message: authenticated
      ? 'Authentication detected. You can now Save Auth State.'
      : 'Authentication not detected yet. Continue login/QR/OTP steps in browser window.'
  });
});

app.post('/api/auth/save', async (_req, res) => {
  if (!authSession) {
    return res.status(400).json({ error: 'No active auth session' });
  }

  const config = await readJson<ProjectConfig | null>(configPath, null);
  if (!config) {
    return res.status(400).json({ error: 'Missing project config' });
  }

  await authSession.context.storageState({ path: config.storageStatePath });
  await authSession.context.close();
  await authSession.browser.close();
  authSession = null;

  logAudit('auth.saved', { storageStatePath: config.storageStatePath });
  res.json({ ok: true, message: 'Auth saved successfully. Continue with workflow recording.' });
});

app.post('/api/auth/cancel', async (_req, res) => {
  if (authSession) {
    await authSession.context.close().catch(() => undefined);
    await authSession.browser.close().catch(() => undefined);
    authSession = null;
  }

  res.json({ ok: true });
});

app.post('/api/record/start', async (_req, res) => {
  if (codegenProcess) return res.status(409).json({ error: 'Recording already running' });
  const config = await readJson<ProjectConfig | null>(configPath, null);
  if (!config) return res.status(400).json({ error: 'Missing project config' });

  const args = getPlaywrightCliArgs(config.baseUrl);
  codegenProcess = spawn(process.execPath, args, { stdio: 'pipe' });

  codegenProcess.on('error', (error) => {
    logAudit('record.spawn.error', { message: error.message });
    codegenProcess = null;
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
