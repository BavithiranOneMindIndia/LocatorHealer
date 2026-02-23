import { Router } from 'express';
import { getProposals, getRegistry } from '../core/locatorRegistry.js';

const router = Router();

router.get('/registry', async (_req, res) => {
  res.json(await getRegistry());
});

router.get('/proposals', async (_req, res) => {
  res.json(await getProposals());
});

router.post('/scan', async (_req, res) => {
  const proposals = await getProposals();
  res.json({ ok: true, proposals });
});

export default router;
