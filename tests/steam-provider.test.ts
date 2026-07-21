import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("SteamStoreProvider", () => {
  beforeEach(() => vi.resetModules());

  it("normaliza e sanitiza os metadados da Store", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      "105600": {
        success: true,
        data: {
          type: "game",
          name: "Terraria",
          header_image: "https://cdn.akamai.steamstatic.com/terraria.jpg",
          short_description: "<b>Dig, fight &amp; explore.</b>",
          detailed_description: "<p>Sem <script>alert(1)</script> marcação.</p>",
          is_free: false,
          platforms: { windows: true, mac: true, linux: true },
          genres: [{ description: "Ação" }],
          categories: [{ description: "Online Co-op" }, { description: "Multi-player" }],
          developers: ["Re-Logic"],
          publishers: ["Re-Logic"],
          supported_languages: "Português - Brasil, Inglês<strong>*</strong>",
          price_overview: { currency: "BRL", initial: 3299, final: 3299, discount_percent: 0, final_formatted: "R$ 32,99" },
          release_date: { coming_soon: false, date: "16 May, 2011" },
        },
      },
    }), { status: 200 }));
    const { SteamStoreProvider } = await import("@/lib/steam/store-provider");
    const game = await new SteamStoreProvider(fetcher, 1_000, 1).getApp(105600);

    expect(game).toMatchObject({ name: "Terraria", metadataStatus: "complete", developers: ["Re-Logic"], price: { currency: "BRL", final: 3299 } });
    expect(game?.shortDescription).toBe("Dig, fight & explore.");
    expect(game?.fullDescription).not.toContain("<script>");
    expect(game?.features).toEqual(expect.arrayContaining(["coop-online", "multiplayer", "windows", "macos", "linux"]));
  });

  it("faz uma nova tentativa em erro transitório", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ "730": { success: false } }), { status: 200 }));
    const { SteamStoreProvider } = await import("@/lib/steam/store-provider");
    await expect(new SteamStoreProvider(fetcher, 1_000, 2).getApp(730)).resolves.toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe("fetchSteamCatalogPage", () => {
  beforeEach(() => { process.env.STEAM_WEB_API_KEY = "fixture-only-key"; });
  afterEach(() => { delete process.env.STEAM_WEB_API_KEY; });

  it("envia filtros oficiais, cursor e interpreta a continuação", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ response: {
      apps: [{ appid: 42, name: "Fixture Game", last_modified: 100, price_change_number: 7 }],
      have_more_results: true,
      last_appid: 42,
    } }), { status: 200 }));
    const { fetchSteamCatalogPage } = await import("@/lib/steam/catalog-provider");
    const page = await fetchSteamCatalogPage({ lastAppId: 10, ifModifiedSince: 20, maxResults: 500, fetcher, attempts: 1 });
    const url = new URL(String(fetcher.mock.calls[0][0]));
    const input = JSON.parse(url.searchParams.get("input_json") ?? "{}") as Record<string, unknown>;
    expect(url.origin).toBe("https://partner.steam-api.com");
    expect(url.searchParams.get("key")).toBe("fixture-only-key");
    expect(input).toMatchObject({ include_games: true, include_dlc: false, include_software: false, include_videos: false, include_hardware: false, last_appid: 10, if_modified_since: 20, max_results: 500 });
    expect(page).toMatchObject({ last_appid: 42, have_more_results: true });
  });

  it("repete falhas transitórias antes de concluir", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ response: { apps: [], have_more_results: false, last_appid: 0 } }), { status: 200 }));
    const { fetchSteamCatalogPage } = await import("@/lib/steam/catalog-provider");
    await expect(fetchSteamCatalogPage({ fetcher, attempts: 2 })).resolves.toMatchObject({ apps: [], have_more_results: false });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("normaliza espaços e aspas acidentais da configuração", async () => {
    process.env.STEAM_WEB_API_KEY = '  "fixture-only-key"\r\n';
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ response: {
      apps: [], have_more_results: false, last_appid: 0,
    } }), { status: 200 }));
    const { fetchSteamCatalogPage } = await import("@/lib/steam/catalog-provider");
    await fetchSteamCatalogPage({ fetcher, attempts: 1 });
    expect(new URL(String(fetcher.mock.calls[0][0])).searchParams.get("key")).toBe("fixture-only-key");
  });

  it("distingue chave ausente e autenticação rejeitada", async () => {
    delete process.env.STEAM_WEB_API_KEY;
    const { fetchSteamCatalogPage, OfficialStoreServiceProvider } = await import("@/lib/steam/catalog-provider");
    await expect(fetchSteamCatalogPage()).rejects.toMatchObject({ code: "sync_not_configured" });
    await expect(new OfficialStoreServiceProvider().validate()).resolves.toMatchObject({ accepted: false, reason: "missing_key" });

    process.env.STEAM_WEB_API_KEY = "fixture-only-key";
    const rejected = vi.fn().mockResolvedValue(new Response("forbidden", { status: 403 }));
    await expect(fetchSteamCatalogPage({ fetcher: rejected, attempts: 1 })).rejects.toMatchObject({ code: "provider_auth_rejected" });
  });

  it("repete 429 de forma limitada e aceita a página seguinte", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("limited", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ response: { apps: [], have_more_results: false, last_appid: 0 } }), { status: 200 }));
    const { fetchSteamCatalogPage } = await import("@/lib/steam/catalog-provider");
    await expect(fetchSteamCatalogPage({ fetcher, attempts: 2 })).resolves.toMatchObject({ apps: [] });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("rejeita respostas sem a estrutura oficial", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ response: {} }), { status: 200 }));
    const { fetchSteamCatalogPage } = await import("@/lib/steam/catalog-provider");
    await expect(fetchSteamCatalogPage({ fetcher, attempts: 1 })).rejects.toMatchObject({ code: "provider_unavailable" });
  });
});
