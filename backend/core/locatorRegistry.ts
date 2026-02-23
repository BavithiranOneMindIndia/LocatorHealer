import type { HealProposal, LocatorRegistry } from '../types.js';
import { readJson, writeJson } from '../utils/fileManager.js';
import { projectPaths } from '../utils/projectStore.js';

function paths(projectId: string) {
  return projectPaths(projectId);
}

export async function getRegistry(projectId: string): Promise<LocatorRegistry> {
  return readJson<LocatorRegistry>(paths(projectId).registry, {});
}

export async function saveRegistry(projectId: string, registry: LocatorRegistry): Promise<void> {
  await writeJson(paths(projectId).registry, registry);
}

export async function getProposals(projectId: string): Promise<HealProposal[]> {
  return readJson<HealProposal[]>(paths(projectId).proposals, []);
}

export async function saveProposals(projectId: string, proposals: HealProposal[]): Promise<void> {
  await writeJson(paths(projectId).proposals, proposals);
}

export async function addProposal(projectId: string, proposal: HealProposal): Promise<void> {
  const proposals = await getProposals(projectId);
  proposals.push(proposal);
  await saveProposals(projectId, proposals);
}

export async function approveProposal(projectId: string, elementKey: string, approved: boolean): Promise<void> {
  const proposals = await getProposals(projectId);
  const registry = await getRegistry(projectId);
  const idx = proposals.findIndex((p) => p.elementKey === elementKey && !p.approved);
  if (idx < 0) return;

  const proposal = proposals[idx];
  proposal.approved = approved;

  if (approved && registry[elementKey]) {
    registry[elementKey].history.push(registry[elementKey].primary);
    registry[elementKey].primary = proposal.proposedLocator;
    proposals.splice(idx, 1);
    await saveRegistry(projectId, registry);
  }

  await saveProposals(projectId, proposals);
}
