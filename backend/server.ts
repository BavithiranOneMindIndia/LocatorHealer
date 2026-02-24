import cors from 'cors';
import express from 'express';
import configRoutes from './routes/configRoutes.js';
import recordRoutes from './routes/recordRoutes.js';
import runRoutes from './routes/runRoutes.js';
import healRoutes from './routes/healRoutes.js';
import approvalRoutes from './routes/approvalRoutes.js';
import authRoutes from './routes/authRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import { getProposals, getRegistry } from './core/locatorRegistry.js';
import { getActivity } from './utils/activityStore.js';
import { getActiveProjectId, listProjects, readProjectConfig } from './utils/projectStore.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/projects', projectRoutes);
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
  const projects = await listProjects();
  const activeProjectId = await getActiveProjectId();

  if (!activeProjectId) {
    return res.json({ projects, activeProjectId: null, config: null, registry: {}, proposals: [] });
  }

  const config = await readProjectConfig(activeProjectId);
  const registry = await getRegistry(activeProjectId);
  const proposals = await getProposals(activeProjectId);
  res.json({ projects, activeProjectId, config, registry, proposals });
});

app.listen(3001, () => {
  console.log('Backend running on http://localhost:3001');
});
