import { Router } from 'express';
import { createProject, getActiveProjectId, listProjects, readProjectConfig, setActiveProjectId } from '../utils/projectStore.js';

const router = Router();

router.get('/', async (_req, res) => {
  const projects = await listProjects();
  const activeProjectId = await getActiveProjectId();
  res.json({ projects, activeProjectId });
});

router.post('/', async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) return res.status(400).json({ error: 'Project name is required' });

  const project = await createProject(name);
  res.json({ ok: true, project });
});

router.post('/select', async (req, res) => {
  const projectId = typeof req.body?.projectId === 'string' ? req.body.projectId : '';
  if (!projectId) return res.status(400).json({ error: 'projectId is required' });

  await setActiveProjectId(projectId);
  const config = await readProjectConfig(projectId);
  res.json({ ok: true, projectId, config });
});

export default router;
