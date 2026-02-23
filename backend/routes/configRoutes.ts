import { Router } from 'express';
import type { ProjectConfig } from '../types.js';
import { getActiveProjectId, readProjectConfig, saveProjectConfig } from '../utils/projectStore.js';

const router = Router();

async function resolveProjectId(raw?: string): Promise<string | null> {
  return raw || await getActiveProjectId();
}

router.get('/', async (req, res) => {
  const projectId = await resolveProjectId(typeof req.query.projectId === 'string' ? req.query.projectId : undefined);
  if (!projectId) return res.status(400).json({ error: 'No active project selected' });

  const config = await readProjectConfig(projectId);
  res.json({ projectId, config });
});

router.post('/', async (req, res) => {
  const projectId = await resolveProjectId(typeof req.body?.projectId === 'string' ? req.body.projectId : undefined);
  if (!projectId) return res.status(400).json({ error: 'No active project selected' });

  await saveProjectConfig(projectId, req.body.config as ProjectConfig);
  res.json({ ok: true, projectId });
});

export default router;
