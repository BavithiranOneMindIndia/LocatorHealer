import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { readJson, writeJson } from './fileManager.js';
import type { ProjectConfig } from '../types.js';

export interface ProjectItem {
  id: string;
  name: string;
  createdAt: string;
}

const projectsFile = path.resolve('config/projects.json');
const sessionFile = path.resolve('config/session.json');

export function getProjectRoot(projectId: string): string {
  return path.resolve('projects', projectId);
}

export function projectPaths(projectId: string) {
  const root = getProjectRoot(projectId);
  return {
    root,
    config: path.join(root, 'config.json'),
    registry: path.join(root, 'locators', 'registry.json'),
    proposals: path.join(root, 'locators', 'proposed_changes.json'),
    scriptsDir: path.join(root, 'scripts'),
    defaultWorkflow: path.join(root, 'scripts', 'workflow.spec.ts'),
    storageState: path.join(root, 'auth', 'storageState.json')
  };
}

export async function listProjects(): Promise<ProjectItem[]> {
  return readJson<ProjectItem[]>(projectsFile, []);
}

export async function getActiveProjectId(): Promise<string | null> {
  const session = await readJson<{ activeProjectId: string | null }>(sessionFile, { activeProjectId: null });
  return session.activeProjectId;
}

export async function setActiveProjectId(projectId: string): Promise<void> {
  await writeJson(sessionFile, { activeProjectId: projectId });
}

export async function createProject(name: string): Promise<ProjectItem> {
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now();
  const item: ProjectItem = { id, name, createdAt: new Date().toISOString() };
  const projects = await listProjects();
  projects.push(item);
  await writeJson(projectsFile, projects);

  const paths = projectPaths(id);
  await mkdir(path.join(paths.root, 'locators'), { recursive: true });
  await mkdir(path.join(paths.root, 'scripts'), { recursive: true });
  await mkdir(path.join(paths.root, 'auth'), { recursive: true });

  const defaultConfig: ProjectConfig = {
    baseUrl: 'https://web.whatsapp.com/',
    authMode: 'auth',
    mode: 'dev',
    auth: {
      qrEnabled: true,
      loginUrl: 'https://web.whatsapp.com/',
      successUrlIncludes: 'web.whatsapp.com',
      successSelector: '[data-testid="chat-list"]'
    },
    storageStatePath: paths.storageState
  };

  await writeJson(paths.config, defaultConfig);
  await writeJson(paths.registry, {});
  await writeJson(paths.proposals, []);
  await writeJson(paths.storageState, { cookies: [], origins: [] });
  await writeJson(paths.defaultWorkflow, "import type { SmartRunner } from '../../../backend/core/smartRunner.js';\n\nexport async function runWorkflow(smart: SmartRunner): Promise<void> {\n  // add steps\n}\n");

  await setActiveProjectId(id);
  return item;
}

export async function readProjectConfig(projectId: string): Promise<ProjectConfig | null> {
  return readJson<ProjectConfig | null>(projectPaths(projectId).config, null);
}

export async function saveProjectConfig(projectId: string, config: ProjectConfig): Promise<void> {
  await writeJson(projectPaths(projectId).config, config);
}
