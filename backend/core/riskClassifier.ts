export function classifyRisk(score: number, multipleCloseMatches: boolean, validated: boolean): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (!validated) return 'HIGH';
  if (multipleCloseMatches) return 'MEDIUM';
  if (score >= 0.88) return 'LOW';
  if (score >= 0.75) return 'MEDIUM';
  return 'HIGH';
}
