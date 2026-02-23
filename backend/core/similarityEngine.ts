import type { DOMCandidate, LocatorMetadata } from '../types.js';

function tokenSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const aa = a.toLowerCase();
  const bb = b.toLowerCase();
  if (aa === bb) return 1;
  if (aa.includes(bb) || bb.includes(aa)) return 0.85;

  const aTokens = new Set(aa.split(/\s+/));
  const bTokens = new Set(bb.split(/\s+/));
  const overlap = [...aTokens].filter((t) => bTokens.has(t)).length;
  return overlap / Math.max(aTokens.size, bTokens.size, 1);
}

export function computeSimilarity(meta: LocatorMetadata, candidate: DOMCandidate): number {
  const role = meta.role ? (meta.role === candidate.role ? 1 : 0) : 0;
  const aria = meta.ariaLabel ? tokenSimilarity(meta.ariaLabel, candidate.ariaLabel) : 0;
  const text = meta.text ? tokenSimilarity(meta.text, candidate.text) : 0;
  const tag = meta.tag ? (meta.tag === candidate.tag ? 1 : 0) : 0;

  const depthDistance = typeof meta.domDepth === 'number' ? Math.abs(meta.domDepth - candidate.domDepth) : 10;
  const depthScore = Math.max(0, 1 - depthDistance / 15);

  return (role * 0.25) + (aria * 0.30) + (text * 0.20) + (tag * 0.15) + (depthScore * 0.10);
}
