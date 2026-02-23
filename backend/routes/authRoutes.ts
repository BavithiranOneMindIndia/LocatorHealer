import { Router } from 'express';
import path from 'node:path';
import type { ProjectConfig } from '../types.js';
import { closeAuthSession, detectAuthSuccess, persistAuth, startAuthSession, type AuthSession } from '../auth/authManager.js';
import { readJson } from '../utils/fileManager.js';
import { logAudit } from '../utils/logger.js';

const router = Router();
const configPath = path.resolve('config/project.json');
let authSession: AuthSession | null = null;

router.post('/start', async (_req, res) => {
  const config = await readJson<ProjectConfig | null>(configPath, null);
  if (!config || config.authMode !== 'auth') {
    return res.status(400).json({ error: 'Auth mode not enabled' });
  }
  if (authSession) return res.status(409).json({ error: 'Auth session already active' });

  authSession = await startAuthSession(config.baseUrl, config.auth);
  res.json({ ok: true, message: 'Auth browser opened. Complete QR/OTP/login and then check status.' });
});

router.get('/status', async (_req, res) => {
  if (!authSession) return res.json({ active: false, authenticated: false, message: 'No active auth session.' });

  const config = await readJson<ProjectConfig | null>(configPath, null);
  const authenticated = await detectAuthSuccess(authSession, config?.auth);
  res.json({
    active: true,
    authenticated,
    elapsedSec: Math.floor((Date.now() - authSession.startedAt) / 1000),
    currentUrl: authSession.page.url(),
    message: authenticated ? 'Authentication detected. Save auth state.' : 'Still waiting for successful login.'
  });
});

router.post('/save', async (_req, res) => {
  if (!authSession) return res.status(400).json({ error: 'No active auth session.' });
  const config = await readJson<ProjectConfig | null>(configPath, null);
  if (!config) return res.status(400).json({ error: 'Missing project config.' });

  await persistAuth(authSession, config.storageStatePath);
  await closeAuthSession(authSession);
  authSession = null;

  logAudit('auth.saved', { storageStatePath: config.storageStatePath });
  res.json({ ok: true, message: 'Auth saved and reusable for future workflow runs.' });
});

router.post('/cancel', async (_req, res) => {
  await closeAuthSession(authSession);
  authSession = null;
  res.json({ ok: true });
});

router.get('/session', (_req, res) => {
  res.json({ active: Boolean(authSession) });
});

export default router;
