import { Router } from 'express';
import path from 'node:path';
import type { ProjectConfig } from '../types.js';
import { readJson, writeJson } from '../utils/fileManager.js';

const router = Router();
const configPath = path.resolve('config/project.json');

router.get('/', async (_req, res) => {
  const config = await readJson<ProjectConfig | null>(configPath, null);
  res.json({ config });
});

router.post('/', async (req, res) => {
  await writeJson(configPath, req.body as ProjectConfig);
  res.json({ ok: true });
});

export default router;
