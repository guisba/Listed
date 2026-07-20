export interface WeightedCandidate {
  id: string;
  votes: number;
}

export function rankCandidates<T extends WeightedCandidate>(candidates: T[]) {
  return [...candidates].sort(
    (a, b) => b.votes - a.votes || a.id.localeCompare(b.id),
  );
}

export function weightedDraw<T extends WeightedCandidate>(
  candidates: T[],
  random = Math.random,
) {
  if (candidates.length === 0) return null;
  const weights = candidates.map((candidate) => Math.max(1, candidate.votes));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = random() * total;

  for (let index = 0; index < candidates.length; index += 1) {
    cursor -= weights[index];
    if (cursor < 0) return candidates[index];
  }
  return candidates.at(-1) ?? null;
}
