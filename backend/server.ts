import cors from 'cors';
import express from 'express';
import path from 'node:path';
import configRoutes from './routes/configRoutes.js';
import recordRoutes from './routes/recordRoutes.js';
import runRoutes from './routes/runRoutes.js';
import healRoutes from './routes/healRoutes.js';
import approvalRoutes from './routes/approvalRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { readJson } from './utils/fileManager.js';
import type { ProjectConfig } from './types.js';
import { getProposals, getRegistry } from './core/locatorRegistry.js';
import { getActivity } from './utils/activityStore.js';

const app = express();
app.use(cors());
app.use(express.json());

const configPath = path.resolve('config/project.json');

app.use('/api/config', configRoutes);
app.use('/api/record', recordRoutes);
app.use('/api/run', runRoutes);
app.use('/api/heal', healRoutes);
app.use('/api/approve', approvalRoutes);
app.use('/api/auth', authRoutes);


app.get('/api/activity', (_req, res) => {
  res.json({ events: getActivity() });
});

app.get('/api/state', async (_req, res) => {
  const config = await readJson<ProjectConfig | null>(configPath, null);
  const registry = await getRegistry();
  const proposals = await getProposals();
  res.json({ config, registry, proposals });
});

app.listen(3001, () => {
  console.log('Backend running on http://localhost:3001');
});
