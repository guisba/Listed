import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/lib/steam/cache", () => ({ resolveSteamGame: vi.fn() }));
vi.mock("@/lib/steam/catalog-sync", () => ({ getSteamCatalogStatus: vi.fn().mockResolvedValue({ status: "partial", catalogComplete: false, indexedGames: 42, lastSyncAt: null }) }));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveSteamGame } from "@/lib/steam/cache";
import { GET } from "@/app/api/steam/search/route";

describe("GET /api/steam/search", () => {
  const rpc = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: crypto.randomUUID() } } }) },
      rpc,
    } as never);
  });

  it("consulta o índice local por nome", async () => {
    rpc.mockResolvedValue({ data: [{ appid: 105600, name: "Terraria", app_type: "game", catalog_game_id: null }], error: null });
    const response = await GET(new NextRequest("http://localhost/api/steam/search?q=Terraria"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ kind: "matches", source: "index", games: [{ appid: 105600, name: "Terraria" }] });
    expect(rpc).toHaveBeenCalledWith("search_steam_apps", { search_query: "Terraria", result_limit: 12, result_offset: 0 });
  });

  it("resolve AppID e URL pelo pipeline de cache/detalhes", async () => {
    vi.mocked(resolveSteamGame).mockResolvedValue({ appid: 730, name: "Counter-Strike 2", cacheState: "fresh" } as never);
    const response = await GET(new NextRequest("http://localhost/api/steam/search?q=https%3A%2F%2Fstore.steampowered.com%2Fapp%2F730%2F"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ kind: "preview", source: "fresh", games: [{ appid: 730 }] });
    expect(resolveSteamGame).toHaveBeenCalledWith(730, expect.anything());
  });

  it("exige autenticação", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } } as never);
    const response = await GET(new NextRequest("http://localhost/api/steam/search?q=Terraria"));
    expect(response.status).toBe(401);
  });
});
