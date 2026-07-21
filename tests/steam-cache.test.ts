import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ isFeatureEnabled: vi.fn(() => true), getPublicEnv: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: vi.fn() }));

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SteamStoreProvider } from "@/lib/steam/store-provider";
import { resolveSteamGame } from "@/lib/steam/cache";

const providerGame = {
  appid: 999001,
  name: "Outside Index Game",
  type: "game",
  storeUrl: "https://store.steampowered.com/app/999001/",
  headerImage: null,
  coverImage: null,
  shortDescription: "Real provider fixture.",
  fullDescription: null,
  releaseDate: null,
  comingSoon: false,
  platforms: ["windows"],
  genres: [],
  categories: [],
  features: ["windows"],
  developers: [],
  publishers: [],
  supportedLanguages: [],
  price: null,
  isFree: false,
  metadataStatus: "complete" as const,
};

describe("resolveSteamGame", () => {
  const indexUpsert = vi.fn(async () => ({ error: null }));
  const stateUpdate = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));

  beforeEach(() => {
    vi.clearAllMocks();
    const admin = {
      from: vi.fn((table: string) => {
        if (table === "catalog_games") return {
            upsert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: "catalog-id" }, error: null })) })) })),
            update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
          };
        if (table === "steam_app_index") return {
          upsert: indexUpsert,
          select: vi.fn(() => ({ eq: vi.fn(async () => ({ count: 5, error: null })) })),
        };
        return { update: stateUpdate };
      }),
    };
    vi.mocked(getSupabaseAdmin).mockReturnValue(admin as never);
  });

  it("hidrata AppID ausente pelo provider e atualiza o índice real", async () => {
    vi.spyOn(SteamStoreProvider.prototype, "getApp").mockResolvedValue(providerGame);
    const browserClient = {
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) })),
    };
    const result = await resolveSteamGame(providerGame.appid, browserClient as never);

    expect(result).toMatchObject({ appid: providerGame.appid, cacheState: "uncached" });
    expect(indexUpsert).toHaveBeenCalledWith(expect.objectContaining({ appid: providerGame.appid, source: "individual_lookup", is_available: true }), { onConflict: "appid" });
    expect(stateUpdate).toHaveBeenCalledWith(expect.objectContaining({ total_indexed: 5 }));
  });

  it("retorna erro específico quando o AppID não representa um jogo", async () => {
    vi.spyOn(SteamStoreProvider.prototype, "getApp").mockResolvedValue(null);
    const browserClient = {
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) })),
    };
    await expect(resolveSteamGame(999002, browserClient as never)).rejects.toThrow("Nenhum jogo da Steam foi encontrado para esse AppID.");
  });
});
