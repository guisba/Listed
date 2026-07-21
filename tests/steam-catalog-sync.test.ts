import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SteamError } from "@/lib/steam/errors";
import { steamCatalogPage } from "@/tests/fixtures/steam-catalog";

vi.mock("server-only", () => ({}));

interface IndexRow {
  appid: number;
  name: string;
  last_modified: number | null;
  price_change_number: number | null;
  is_available: boolean;
  source: "official_store_service" | "individual_lookup";
}

function createAdmin({ startCursor = 0, modifiedSince = 0, acquired = true, existing = [] as IndexRow[] } = {}) {
  const index = new Map(existing.map((row) => [row.appid, row]));
  const checkpoints: number[] = [];
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name === "claim_steam_catalog_sync") return { data: [{ acquired, sync_mode: args.requested_mode, start_cursor: startCursor, modified_since: modifiedSince, generation: crypto.randomUUID(), claim_token: acquired ? crypto.randomUUID() : null }], error: null };
    if (name === "checkpoint_steam_catalog_sync") {
      checkpoints.push(Number(args.next_cursor));
      return { data: true, error: null };
    }
    return { data: true, error: null };
  });
  const from = vi.fn((table: string) => {
    if (table === "steam_app_index") {
      return {
        select: vi.fn(() => ({ in: vi.fn(async (_column: string, ids: number[]) => ({ data: ids.map((id) => index.get(id)).filter(Boolean), error: null })) })),
        upsert: vi.fn(async (rows: Array<Record<string, unknown>>) => {
          for (const row of rows) index.set(Number(row.appid), { appid: Number(row.appid), name: String(row.name), last_modified: Number(row.last_modified) || null, price_change_number: Number(row.price_change_number) || null, is_available: Boolean(row.is_available), source: row.source as IndexRow["source"] });
          return { error: null };
        }),
      };
    }
    return {
      insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: crypto.randomUUID() }, error: null })) })) })),
      update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
    };
  });
  return { admin: { rpc, from } as never, rpc, checkpoints, index };
}

describe("runSteamCatalogSync", () => {
  beforeEach(() => { process.env.STEAM_WEB_API_KEY = "fixture-only-key"; });
  afterEach(() => { delete process.env.STEAM_WEB_API_KEY; vi.restoreAllMocks(); });

  it("percorre cursor inicial, cursor seguinte e página final vazia", async () => {
    const harness = createAdmin();
    const fetchPage = vi.fn()
      .mockResolvedValueOnce(steamCatalogPage(0, 2, true))
      .mockResolvedValueOnce(steamCatalogPage(2, 0, false));
    const { runSteamCatalogSync } = await import("@/lib/steam/catalog-sync");
    const result = await runSteamCatalogSync({ mode: "full", triggerSource: "manual", admin: harness.admin, fetchPage });

    expect(fetchPage.mock.calls.map(([options]) => options.lastAppId)).toEqual([0, 2]);
    expect(harness.checkpoints).toEqual([2, 2]);
    expect(result).toMatchObject({ status: "complete", pagesProcessed: 2, received: 2, inserted: 2, checkpoint: 0, catalogComplete: true });
  });

  it("interrompe por lote, preserva checkpoint e permite retomada", async () => {
    const harness = createAdmin({ startCursor: 40 });
    const fetchPage = vi.fn().mockResolvedValue(steamCatalogPage(40, 3, true));
    const { runSteamCatalogSync } = await import("@/lib/steam/catalog-sync");
    const result = await runSteamCatalogSync({ mode: "full", triggerSource: "cron", maxPages: 1, admin: harness.admin, fetchPage });

    expect(fetchPage).toHaveBeenCalledWith(expect.objectContaining({ lastAppId: 40, ifModifiedSince: 0 }));
    expect(result).toMatchObject({ status: "partial", pagesProcessed: 1, checkpoint: 43 });
  });

  it("registra falha intermediária sem apagar o último checkpoint confirmado", async () => {
    const harness = createAdmin();
    const fetchPage = vi.fn()
      .mockResolvedValueOnce(steamCatalogPage(0, 2, true))
      .mockRejectedValueOnce(new SteamError("provider_unavailable", 502));
    const { runSteamCatalogSync } = await import("@/lib/steam/catalog-sync");

    await expect(runSteamCatalogSync({ mode: "full", triggerSource: "manual", admin: harness.admin, fetchPage })).rejects.toMatchObject({ code: "provider_unavailable" });
    expect(harness.checkpoints).toEqual([2]);
    expect(harness.rpc).toHaveBeenCalledWith("fail_steam_catalog_sync", expect.objectContaining({ claim_token: expect.any(String) }));
  });

  it("separa inseridos, atualizados, ignorados e deduplica por AppID", async () => {
    const harness = createAdmin({ existing: [
      { appid: 1, name: "Catalog Game 1", last_modified: 1_720_000_000, price_change_number: 10, is_available: true, source: "individual_lookup" },
      { appid: 2, name: "Nome antigo", last_modified: 1, price_change_number: 1, is_available: true, source: "official_store_service" },
    ] });
    const fetchPage = vi.fn().mockResolvedValue(steamCatalogPage(0, 3, false));
    const { runSteamCatalogSync } = await import("@/lib/steam/catalog-sync");
    const result = await runSteamCatalogSync({ mode: "full", triggerSource: "manual", admin: harness.admin, fetchPage });

    expect(result).toMatchObject({ inserted: 1, updated: 1, ignored: 1, received: 3 });
    expect(harness.index.size).toBe(3);
    expect(harness.index.get(1)?.source).toBe("individual_lookup");
  });

  it("usa checkpoint separado e timestamp na sincronização incremental", async () => {
    const harness = createAdmin({ startCursor: 700, modifiedSince: 1_710_000_000 });
    const fetchPage = vi.fn().mockResolvedValue(steamCatalogPage(700, 1, false));
    const { runSteamCatalogSync } = await import("@/lib/steam/catalog-sync");
    await runSteamCatalogSync({ mode: "incremental", triggerSource: "manual", admin: harness.admin, fetchPage });
    expect(fetchPage).toHaveBeenCalledWith(expect.objectContaining({ lastAppId: 700, ifModifiedSince: 1_710_000_000 }));
  });

  it("contabiliza item inválido como ignorado e não o persiste", async () => {
    const harness = createAdmin();
    const page = { ...steamCatalogPage(0, 2, false), invalid_items: 1 };
    const { runSteamCatalogSync } = await import("@/lib/steam/catalog-sync");
    const result = await runSteamCatalogSync({ mode: "full", triggerSource: "manual", admin: harness.admin, fetchPage: vi.fn().mockResolvedValue(page) });
    expect(result).toMatchObject({ received: 3, inserted: 2, ignored: 1, errors: 0 });
    expect(harness.index.size).toBe(2);
  });

  it("recusa uma execução concorrente", async () => {
    const harness = createAdmin({ acquired: false });
    const fetchPage = vi.fn();
    const { runSteamCatalogSync } = await import("@/lib/steam/catalog-sync");
    await expect(runSteamCatalogSync({ mode: "full", triggerSource: "manual", admin: harness.admin, fetchPage })).resolves.toMatchObject({ status: "already_running" });
    expect(fetchPage).not.toHaveBeenCalled();
  });
});
