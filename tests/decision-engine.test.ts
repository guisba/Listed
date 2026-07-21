import { describe, expect, it } from "vitest";
import { rankCandidates, weightedDraw } from "@/features/decisions/engine";

const games = [{ id: "b", votes: 1 }, { id: "a", votes: 3 }, { id: "c", votes: 0 }];

describe("decision engine", () => {
  it("ordena por votos com desempate estável", () => expect(rankCandidates(games).map((game) => game.id)).toEqual(["a", "b", "c"]));
  it("faz sorteio ponderado previsível com RNG injetado", () => expect(weightedDraw(games, () => 0.3)?.id).toBe("a"));
  it("retorna null sem candidatos", () => expect(weightedDraw([])).toBeNull());
});
