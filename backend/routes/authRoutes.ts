import { Router } from 'express';
import { closeAuthSession, detectAuthSuccess, persistAuth, startAuthSession, type AuthSession } from '../auth/authManager.js';
import { getActiveProjectId, readProjectConfig } from '../utils/projectStore.js';
import { logAudit } from '../utils/logger.js';

const router = Router();
let authSession: AuthSession | null = null;

async function resolveProjectId(raw?: string): Promise<string | null> {
  return raw || await getActiveProjectId();
}

router.post('/start', async (req, res) => {
  const projectId = await resolveProjectId(typeof req.body?.projectId === 'string' ? req.body.projectId : undefined);
  if (!projectId) return res.status(400).json({ error: 'No active project selected' });

  const config = await readProjectConfig(projectId);
  if (!config || config.authMode !== 'auth') {
    return res.status(400).json({ error: 'Auth mode not enabled' });
  }
  if (authSession) return res.status(409).json({ error: 'Auth session already active' });

  authSession = await startAuthSession(config.baseUrl, config.auth);
  res.json({ ok: true, message: 'Auth browser opened. Complete QR/OTP/login and then check status.' });
});

router.get('/status', async (req, res) => {
  if (!authSession) return res.json({ active: false, authenticated: false, message: 'No active auth session.' });

  const projectId = await resolveProjectId(typeof req.query.projectId === 'string' ? req.query.projectId : undefined);
  if (!projectId) return res.status(400).json({ error: 'No active project selected' });

  const config = await readProjectConfig(projectId);
  const authenticated = await detectAuthSuccess(authSession, config?.auth);
  res.json({
    active: true,
    authenticated,
    elapsedSec: Math.floor((Date.now() - authSession.startedAt) / 1000),
    currentUrl: authSession.page.url(),
    message: authenticated ? 'Authentication detected. Save auth state.' : 'Still waiting for successful login.'
  });
});

router.post('/save', async (req, res) => {
  if (!authSession) return res.status(400).json({ error: 'No active auth session.' });
  const projectId = await resolveProjectId(typeof req.body?.projectId === 'string' ? req.body.projectId : undefined);
  if (!projectId) return res.status(400).json({ error: 'No active project selected' });

  const config = await readProjectConfig(projectId);
  if (!config) return res.status(400).json({ error: 'Missing project config.' });

  await persistAuth(authSession, config.storageStatePath);
  await closeAuthSession(authSession);
  authSession = null;

  logAudit('auth.saved', { storageStatePath: config.storageStatePath, projectId });
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
