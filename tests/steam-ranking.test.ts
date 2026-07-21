import { describe, expect, it } from "vitest";
import { compareSteamSearchCandidates, listedPopularityScore, scoreSteamSearchCandidate } from "@/lib/steam/ranking";

describe("Steam search ranking", () => {
  it("mantém correspondência exata acima da popularidade máxima", () => {
    const exact = scoreSteamSearchCandidate({ appid: 1, name: "Hades", match: "exact", type: "game", popularityScore: 0 });
    const popularPrefix = scoreSteamSearchCandidate({ appid: 2, name: "Hades II", match: "prefix", similarity: 1, type: "game", popularityScore: 250 });
    expect(exact.finalScore).toBeGreaterThan(popularPrefix.finalScore);
  });

  it("ordena prefixo antes de contenção e jogo antes de DLC equivalente", () => {
    const candidates = [
      { appid: 3, name: "The Portal Files", match: "contains" as const, type: "game" },
      { appid: 2, name: "Portal DLC", match: "prefix" as const, type: "dlc" },
      { appid: 1, name: "Portal Stories", match: "prefix" as const, type: "game" },
    ].sort(compareSteamSearchCandidates);
    expect(candidates.map((candidate) => candidate.appid)).toEqual([1, 2, 3]);
  });

  it("usa popularidade limitada como desempate e mantém ordem determinística", () => {
    const score = listedPopularityScore(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    expect(score).toBe(250);
    expect(listedPopularityScore(null, null, null)).toBe(0);
    const candidates = [
      { appid: 9, name: "Don't Starve", match: "prefix" as const, type: "game", popularityScore: 10 },
      { appid: 8, name: "Don't Starve Together", match: "prefix" as const, type: "game", popularityScore: 20 },
    ].sort(compareSteamSearchCandidates);
    expect(candidates.map((candidate) => candidate.appid)).toEqual([8, 9]);
  });
});
