import { describe, expect, it, vi } from "vitest";

import {
  LEGACY_APPLIST_URL,
  LegacyCatalogError,
  downloadLegacyAppList,
  parseLegacyAppList,
  persistLegacyCatalog,
  splitLegacyCatalog,
  type DownloadedLegacyCatalog,
} from "@/scripts/steam-catalog-legacy";

function response(payload: unknown, status = 200, contentType = "application/json; charset=utf-8") {
  return new Response(typeof payload === "string" ? payload : JSON.stringify(payload), {
    status,
    headers: { "Content-Type": contentType },
  });
}

function generatedCatalog(total: number): DownloadedLegacyCatalog {
  return {
    apps: Array.from({ length: total }, (_, index) => ({
      appid: index + 1,
      name: `Generated Game ${index + 1}`,
      normalized_name: `generated game ${index + 1}`,
    })),
    totalReceived: total,
    totalRejected: 0,
    sourceHash: "a".repeat(64),
    status: 200,
    contentType: "application/json",
    durationMs: 10,
    payloadBytes: total * 48,
  };
}

function adminHarness({ startBatch = 0, failBatch = -1 } = {}) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args });
    if (name === "claim_legacy_public_applist") {
      return { data: [{ acquired: true, start_batch: startBatch, claim_token: "claim", resumed: startBatch > 0 }], error: null };
    }
    if (name === "upsert_legacy_public_applist_batch") {
      if (Number(args.p_batch_index) === failBatch) return { data: null, error: { message: "fixture failure" } };
      const count = Array.isArray(args.p_apps) ? args.p_apps.length : 0;
      return { data: [{ inserted_count: count, updated_count: 0, ignored_count: 0, persisted_count: count }], error: null };
    }
    return { data: true, error: null };
  });
  return { admin: { rpc } as never, rpc, calls };
}

describe("legacy public AppList", () => {
  it("valida applist.apps, normaliza nomes e rejeita itens inválidos ou repetidos", () => {
    const parsed = parseLegacyAppList({ applist: { apps: [
      { appid: 1, name: "  Baldur's Gate 3  " },
      { appid: 2, name: "Counter-Strike 2" },
      { appid: 2, name: "Counter-Strike 2" },
      { appid: 0, name: "Inválido" },
      { appid: 3, name: "" },
      null,
    ] } });
    expect(parsed.apps).toEqual([
      { appid: 1, name: "Baldur's Gate 3", normalized_name: "baldurs gate 3" },
      { appid: 2, name: "Counter-Strike 2", normalized_name: "counter strike 2" },
    ]);
    expect(parsed).toMatchObject({ totalReceived: 6, totalRejected: 4 });
  });

  it.each([
    [{}, "Resposta da Valve sem applist."],
    [{ applist: {} }, "Resposta da Valve sem applist.apps."],
  ])("recusa uma estrutura oficial incompleta", (payload, message) => {
    expect(() => parseLegacyAppList(payload)).toThrow(message);
  });

  it("divide 10 mil registros em lotes de mil sem perder itens", () => {
    const records = Array.from({ length: 10_000 }, (_, index) => index);
    const batches = splitLegacyCatalog(records, 1_000);
    expect(batches).toHaveLength(10);
    expect(batches.flat()).toEqual(records);
  });

  it("usa exatamente a rota pública, GET sem chave, corpo ou parâmetros", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ applist: { apps: [{ appid: 42, name: "Fixture" }] } }));
    const catalog = await downloadLegacyAppList({ fetcher, attempts: 1 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe(LEGACY_APPLIST_URL);
    expect(new URL(String(fetcher.mock.calls[0][0])).search).toBe("");
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: "GET" });
    expect(fetcher.mock.calls[0][1]).not.toHaveProperty("body");
    expect(catalog).toMatchObject({ status: 200, totalReceived: 1, totalRejected: 0 });
  });

  it("não tenta novamente em 404 e identifica o erro sem ler o corpo como catálogo", async () => {
    const fetcher = vi.fn().mockResolvedValue(response("not found", 404, "text/html"));
    await expect(downloadLegacyAppList({ fetcher })).rejects.toMatchObject({ code: "http_404", httpStatus: 404 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("repete 429 e 5xx de forma limitada", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response("limited", 429, "text/plain"))
      .mockResolvedValueOnce(response("busy", 503, "text/plain"))
      .mockResolvedValueOnce(response({ applist: { apps: [{ appid: 10, name: "Recovered" }] } }));
    await expect(downloadLegacyAppList({ fetcher, attempts: 3 })).resolves.toMatchObject({ totalReceived: 1 });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("recusa content-type, JSON e tamanho inesperados", async () => {
    await expect(downloadLegacyAppList({
      fetcher: vi.fn().mockResolvedValue(response("<html />", 200, "text/html")),
      attempts: 1,
    })).rejects.toMatchObject({ code: "invalid_content_type" });
    await expect(downloadLegacyAppList({
      fetcher: vi.fn().mockResolvedValue(response("{", 200)),
      attempts: 1,
    })).rejects.toMatchObject({ code: "invalid_json" });
    await expect(downloadLegacyAppList({
      fetcher: vi.fn().mockResolvedValue(response({ applist: { apps: [{ appid: 1, name: "Oversized" }] } })),
      attempts: 1,
      maxBytes: 4,
    })).rejects.toMatchObject({ code: "payload_too_large" });
  });

  it("persiste uma fixture de 10 mil itens em dez upserts e conclui", async () => {
    const harness = adminHarness();
    const result = await persistLegacyCatalog({ admin: harness.admin, catalog: generatedCatalog(10_000) });
    expect(result).toMatchObject({ status: "complete_legacy", batchesProcessed: 10, inserted: 10_000, persisted: 10_000 });
    expect(harness.calls.filter((call) => call.name === "upsert_legacy_public_applist_batch")).toHaveLength(10);
    expect(harness.rpc).toHaveBeenCalledWith("finish_legacy_public_applist", expect.objectContaining({ p_total_failed: 0 }));
  });

  it("preserva a falha intermediária e retoma no lote confirmado seguinte", async () => {
    const failed = adminHarness({ failBatch: 2 });
    await expect(persistLegacyCatalog({ admin: failed.admin, catalog: generatedCatalog(4_000) }))
      .rejects.toBeInstanceOf(LegacyCatalogError);
    expect(failed.rpc).toHaveBeenCalledWith("fail_legacy_public_applist", expect.objectContaining({ p_claim_token: "claim" }));

    const resumed = adminHarness({ startBatch: 2 });
    const result = await persistLegacyCatalog({ admin: resumed.admin, catalog: generatedCatalog(4_000) });
    expect(result).toMatchObject({ resumed: true, startBatch: 2, batchesProcessed: 2, lastBatch: 3, persisted: 2_000 });
  });

  it("pausa com checkpoint quando existe um limite operacional de lotes", async () => {
    const harness = adminHarness();
    const result = await persistLegacyCatalog({ admin: harness.admin, catalog: generatedCatalog(3_000), maxBatches: 1 });
    expect(result).toMatchObject({ status: "partial", batchesProcessed: 1, lastBatch: 0 });
    expect(harness.rpc).toHaveBeenCalledWith("pause_legacy_public_applist", { p_claim_token: "claim" });
  });
});
