import { Router } from 'express';
import { approveProposal } from '../core/locatorRegistry.js';

const router = Router();

router.post('/', async (req, res) => {
  const { elementKey, approved } = req.body as { elementKey: string; approved: boolean };
  await approveProposal(elementKey, approved);
  res.json({ ok: true });
});

export default router;
