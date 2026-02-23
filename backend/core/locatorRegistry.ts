import path from 'node:path';
import type { HealProposal, LocatorRegistry } from '../types.js';
import { readJson, writeJson } from '../utils/fileManager.js';

const registryPath = path.resolve('locators/registry.json');
const proposalPath = path.resolve('locators/proposed_changes.json');

export async function getRegistry(): Promise<LocatorRegistry> {
  return readJson<LocatorRegistry>(registryPath, {});
}

export async function saveRegistry(registry: LocatorRegistry): Promise<void> {
  await writeJson(registryPath, registry);
}

export async function getProposals(): Promise<HealProposal[]> {
  return readJson<HealProposal[]>(proposalPath, []);
}

export async function saveProposals(proposals: HealProposal[]): Promise<void> {
  await writeJson(proposalPath, proposals);
}

export async function addProposal(proposal: HealProposal): Promise<void> {
  const proposals = await getProposals();
  proposals.push(proposal);
  await saveProposals(proposals);
}

export async function approveProposal(elementKey: string, approved: boolean): Promise<void> {
  const proposals = await getProposals();
  const registry = await getRegistry();
  const idx = proposals.findIndex((p) => p.elementKey === elementKey && !p.approved);
  if (idx < 0) return;

  const proposal = proposals[idx];
  proposal.approved = approved;

  if (approved && registry[elementKey]) {
    registry[elementKey].history.push(registry[elementKey].primary);
    registry[elementKey].primary = proposal.proposedLocator;
    proposals.splice(idx, 1);
    await saveRegistry(registry);
  }

  await saveProposals(proposals);
}
