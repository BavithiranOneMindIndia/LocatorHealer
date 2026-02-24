import { Router } from 'express';
import { approveProposal } from '../core/locatorRegistry.js';
import { getActiveProjectId } from '../utils/projectStore.js';

const router = Router();

router.post('/', async (req, res) => {
  const { elementKey, approved, projectId: rawProjectId } = req.body as { elementKey: string; approved: boolean; projectId?: string };
  const projectId = rawProjectId || await getActiveProjectId();
  if (!projectId) return res.status(400).json({ error: 'No active project selected' });

  await approveProposal(projectId, elementKey, approved);
  res.json({ ok: true });
});

export default router;
