import { describe, expect, it } from "vitest";
import {
  EMPTY_SESSION_FILTERS,
  filterSessionGames,
  parseSessionFilters,
  serializeSessionFilters,
  toggleSessionFilter,
  type ActiveSessionFilters,
} from "@/features/sessions/filters";
import type { SessionGame } from "@/types/domain";

function game(overrides: Partial<SessionGame>): SessionGame {
  return {
    id: crypto.randomUUID(),
    session_id: crypto.randomUUID(),
    catalog_game_id: null,
    source: "steam",
    name: "Game",
    normalized_name: "game",
    image_url: null,
    store_url: null,
    platforms: [],
    features: [],
    min_players: null,
    max_players: null,
    added_by: crypto.randomUUID(),
    created_at: "2026-07-27T00:00:00Z",
    ...overrides,
  };
}

describe("session filters", () => {
  const games = [
    game({ name: "Terraria", features: ["singleplayer", "multiplayer", "coop-online"], platforms: ["windows", "linux"], owner_count: 3, ownership_status: "owns" }),
    game({ name: "Couch", features: ["coop-local", "controller-support"], platforms: ["windows"], owner_count: 1, ownership_status: "does_not_own" }),
    game({ name: "Solo Mac", features: ["singleplayer"], platforms: ["macos"], owner_count: 0, ownership_status: "unknown" }),
  ];

  it("combina OR dentro de uma categoria e AND entre categorias", () => {
    const filters: ActiveSessionFilters = {
      ...EMPTY_SESSION_FILTERS,
      mode: ["coop-online", "coop-local"],
      platform: ["linux"],
    };
    expect(filterSessionGames(games, filters, 3).map((item) => item.name)).toEqual(["Terraria"]);
  });

  it("usa propriedade individual e agregada sem fallback silencioso", () => {
    expect(filterSessionGames(games, { ...EMPTY_SESSION_FILTERS, ownership: ["owned-by-all"] }, 3)).toHaveLength(1);
    expect(filterSessionGames(games, { ...EMPTY_SESSION_FILTERS, ownership: ["owned-by-me"] }, 3)[0]?.name).toBe("Terraria");
    expect(filterSessionGames(games, { ...EMPTY_SESSION_FILTERS, ownership: ["owned-by-any"] }, 3).map((item) => item.name)).toEqual(["Terraria", "Couch"]);
    expect(filterSessionGames(games, { ...EMPTY_SESSION_FILTERS, ownership: ["owned-by-none"] }, 3)[0]?.name).toBe("Solo Mac");
  });

  it.each([
    ["singleplayer", "mode"],
    ["multiplayer", "mode"],
    ["coop", "mode"],
    ["coop-online", "mode"],
    ["coop-local", "mode"],
    ["windows", "platform"],
    ["macos", "platform"],
    ["linux", "platform"],
    ["controller-support", "resource"],
    ["remote-play", "resource"],
    ["pvp", "resource"],
    ["pvp-online", "resource"],
  ] as const)("filtra o valor estável %s sem depender do label", (value, group) => {
    const matching = game({
      name: "Matching",
      features: ["singleplayer", "multiplayer", "coop", "coop-online", "coop-local", "controller-support", "remote-play", "pvp", "pvp-online"],
      platforms: ["windows", "macos", "linux"],
    });
    const filters = { ...EMPTY_SESSION_FILTERS, [group]: [value] };
    expect(filterSessionGames([matching, game({ name: "Other" })], filters, 2).map((item) => item.name)).toEqual(["Matching"]);
  });

  it("trata arrays e agregados ausentes como estado vazio", () => {
    const incomplete = game({ features: null as never, platforms: null as never, owner_count: undefined });
    expect(filterSessionGames([incomplete], { ...EMPTY_SESSION_FILTERS, mode: ["coop"] }, 2)).toEqual([]);
    expect(filterSessionGames([incomplete], { ...EMPTY_SESSION_FILTERS, ownership: ["owned-by-none"] }, 2)).toEqual([incomplete]);
  });

  it("serializa somente valores conhecidos e ignora valores adulterados", () => {
    const selected = toggleSessionFilter(EMPTY_SESSION_FILTERS, "mode", "coop-online");
    const encoded = serializeSessionFilters(selected);
    expect(encoded).toBe("mode:coop-online");
    expect(parseSessionFilters(`${encoded},admin:true,platform:windows`).mode).toEqual(["coop-online"]);
    expect(parseSessionFilters(`${encoded},admin:true,platform:windows`).platform).toEqual(["windows"]);
  });
});
