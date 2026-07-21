export type SteamMatchKind = "appid_exact" | "exact" | "normalized_exact" | "prefix" | "word_prefix" | "similarity" | "contains";

const BASE_TEXT_SCORES: Record<SteamMatchKind, number> = {
  appid_exact: 2_000,
  exact: 1_500,
  normalized_exact: 1_450,
  prefix: 1_100,
  word_prefix: 900,
  similarity: 450,
  contains: 200,
};

export function textRelevanceScore(match: SteamMatchKind, similarity = 0) {
  const boundedSimilarity = Math.min(1, Math.max(0, similarity));
  if (match === "prefix" || match === "word_prefix") return BASE_TEXT_SCORES[match] + 50 * boundedSimilarity;
  if (match === "similarity") return BASE_TEXT_SCORES[match] + 250 * boundedSimilarity;
  if (match === "contains") return BASE_TEXT_SCORES[match] + 200 * boundedSimilarity;
  return BASE_TEXT_SCORES[match];
}

export function steamTypeScore(type: string) {
  const scores: Record<string, number> = {
    game: 150,
    unknown: 0,
    demo: -150,
    dlc: -400,
    soundtrack: -500,
    software: -600,
    tool: -600,
  };
  return scores[type.toLowerCase()] ?? 0;
}

export function listedPopularityScore(additions: number | null, votes: number | null, uniqueGroups: number | null, recommendationsTotal: number | null = null) {
  const safe = (value: number | null) => Number.isFinite(value) ? Math.max(0, value ?? 0) : 0;
  return Math.min(
    250,
    60 * Math.log1p(safe(uniqueGroups))
      + 18 * Math.log1p(safe(votes))
      + 8 * Math.log1p(safe(additions))
      + 9 * Math.log1p(safe(recommendationsTotal)),
  );
}

export interface SteamRankingCandidate {
  appid: number;
  name: string;
  match: SteamMatchKind;
  similarity?: number;
  type: string;
  popularityScore?: number | null;
}

export function scoreSteamSearchCandidate(candidate: SteamRankingCandidate) {
  const textScore = textRelevanceScore(candidate.match, candidate.similarity);
  const typeScore = steamTypeScore(candidate.type);
  const popularityScore = Math.min(250, Math.max(0, candidate.popularityScore ?? 0));
  return { textScore, typeScore, popularityScore, finalScore: textScore + typeScore + popularityScore };
}

export function compareSteamSearchCandidates(left: SteamRankingCandidate, right: SteamRankingCandidate) {
  const leftScore = scoreSteamSearchCandidate(left);
  const rightScore = scoreSteamSearchCandidate(right);
  return rightScore.finalScore - leftScore.finalScore
    || rightScore.textScore - leftScore.textScore
    || rightScore.popularityScore - leftScore.popularityScore
    || left.name.localeCompare(right.name)
    || left.appid - right.appid;
}
