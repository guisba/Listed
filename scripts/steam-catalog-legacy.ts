import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeName } from "../lib/utils";

export const LEGACY_APPLIST_URL = "https://api.steampowered.com/ISteamApps/GetAppList/v2/";
export const DEFAULT_LEGACY_BATCH_SIZE = 1_000;
export const DEFAULT_LEGACY_MAX_BYTES = 96 * 1024 * 1024;
export const LEGACY_PROVIDER_ID = "legacy_public_applist" as const;

const TRANSIENT_STATUS = new Set([429, 500, 502, 503, 504]);

export type LegacyCatalogErrorCode =
  | "http_404"
  | "rate_limited"
  | "upstream_unavailable"
  | "timeout"
  | "invalid_content_type"
  | "payload_too_large"
  | "invalid_json"
  | "invalid_payload"
  | "database_unavailable"
  | "already_running";

export class LegacyCatalogError extends Error {
  constructor(
    public readonly code: LegacyCatalogErrorCode,
    message: string,
    public readonly httpStatus?: number,
  ) {
    super(message);
    this.name = "LegacyCatalogError";
  }
}

export interface LegacyCatalogApp {
  appid: number;
  name: string;
  normalized_name: string;
}

export interface ParsedLegacyCatalog {
  apps: LegacyCatalogApp[];
  totalReceived: number;
  totalRejected: number;
}

export interface DownloadedLegacyCatalog extends ParsedLegacyCatalog {
  sourceHash: string;
  status: number;
  contentType: string;
  durationMs: number;
  payloadBytes: number;
}

export class LegacyPublicAppListProvider {
  readonly id = LEGACY_PROVIDER_ID;
  readonly purpose = "bootstrap_appid_and_name" as const;

  download(options: DownloadOptions = {}) {
    return downloadLegacyAppList(options);
  }
}

interface DownloadOptions {
  fetcher?: typeof fetch;
  attempts?: number;
  timeoutMs?: number;
  maxBytes?: number;
}

interface BootstrapOptions {
  admin: SupabaseClient;
  catalog: DownloadedLegacyCatalog;
  batchSize?: number;
  maxBatches?: number;
  now?: () => number;
}

interface ClaimRow {
  acquired: boolean;
  start_batch: number;
  claim_token: string | null;
  resumed: boolean;
}

interface BatchResultRow {
  inserted_count: number;
  updated_count: number;
  ignored_count: number;
  persisted_count: number;
}

export interface LegacyBootstrapResult {
  status: "complete_legacy" | "partial" | "already_running";
  resumed: boolean;
  startBatch: number;
  lastBatch: number;
  batchesProcessed: number;
  received: number;
  rejected: number;
  persisted: number;
  inserted: number;
  updated: number;
  ignored: number;
  durationMs: number;
  sourceHash: string;
}

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function downloadError(status: number) {
  if (status === 404) {
    return new LegacyCatalogError(
      "http_404",
      "O endpoint público legado da Valve respondeu 404.",
      status,
    );
  }
  if (status === 429) {
    return new LegacyCatalogError("rate_limited", "A Valve limitou temporariamente o download.", status);
  }
  return new LegacyCatalogError(
    "upstream_unavailable",
    "O endpoint público legado da Valve está indisponível.",
    status,
  );
}

export function parseLegacyAppList(payload: unknown): ParsedLegacyCatalog {
  if (!payload || typeof payload !== "object") {
    throw new LegacyCatalogError("invalid_payload", "Resposta da Valve sem objeto raiz.");
  }
  const applist = (payload as { applist?: unknown }).applist;
  if (!applist || typeof applist !== "object") {
    throw new LegacyCatalogError("invalid_payload", "Resposta da Valve sem applist.");
  }
  const rawApps = (applist as { apps?: unknown }).apps;
  if (!Array.isArray(rawApps)) {
    throw new LegacyCatalogError("invalid_payload", "Resposta da Valve sem applist.apps.");
  }

  const deduplicated = new Map<number, LegacyCatalogApp>();
  for (const item of rawApps) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const appid = Number((item as { appid?: unknown }).appid);
    const nameValue = (item as { name?: unknown }).name;
    const name = typeof nameValue === "string" ? nameValue.trim() : "";
    const normalizedName = normalizeName(name);
    if (!Number.isSafeInteger(appid) || appid <= 0 || appid > 4_294_967_295 || !name || !normalizedName) {
      continue;
    }
    deduplicated.set(appid, { appid, name, normalized_name: normalizedName });
  }

  return {
    apps: [...deduplicated.values()].sort((left, right) => left.appid - right.appid),
    totalReceived: rawApps.length,
    totalRejected: rawApps.length - deduplicated.size,
  };
}

export function splitLegacyCatalog<T>(items: T[], batchSize = DEFAULT_LEGACY_BATCH_SIZE) {
  if (!Number.isInteger(batchSize) || batchSize < 500 || batchSize > 2_000) {
    throw new RangeError("O lote deve conter entre 500 e 2.000 registros.");
  }
  const batches: T[][] = [];
  for (let offset = 0; offset < items.length; offset += batchSize) {
    batches.push(items.slice(offset, offset + batchSize));
  }
  return batches;
}

export async function downloadLegacyAppList({
  fetcher = fetch,
  attempts = 3,
  timeoutMs = 90_000,
  maxBytes = DEFAULT_LEGACY_MAX_BYTES,
}: DownloadOptions = {}): Promise<DownloadedLegacyCatalog> {
  const startedAt = Date.now();
  const boundedAttempts = Math.min(Math.max(attempts, 1), 4);
  let response: Response | null = null;

  for (let attempt = 0; attempt < boundedAttempts; attempt += 1) {
    try {
      response = await fetcher(LEGACY_APPLIST_URL, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "Listed/1.0 (+https://listedme.vercel.app)",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (attempt + 1 < boundedAttempts) continue;
      const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      throw new LegacyCatalogError(
        timeout ? "timeout" : "upstream_unavailable",
        timeout ? "O download do catálogo excedeu o tempo limite." : "Falha de rede ao baixar o catálogo.",
      );
    }
    if (response.ok || !TRANSIENT_STATUS.has(response.status) || attempt + 1 >= boundedAttempts) break;
  }

  if (!response?.ok) throw downloadError(response?.status ?? 502);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("json")) {
    throw new LegacyCatalogError("invalid_content_type", "A Valve respondeu um tipo de conteúdo inesperado.", response.status);
  }
  const declaredBytes = Number(response.headers.get("content-length") ?? 0);
  if (declaredBytes > maxBytes) {
    throw new LegacyCatalogError("payload_too_large", "O catálogo excedeu o limite defensivo de download.");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maxBytes) {
    throw new LegacyCatalogError("payload_too_large", "O catálogo excedeu o limite defensivo de download.");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new LegacyCatalogError("invalid_json", "A Valve respondeu JSON inválido.");
  }
  const parsed = parseLegacyAppList(payload);
  return {
    ...parsed,
    sourceHash: createHash("sha256").update(bytes).digest("hex"),
    status: response.status,
    contentType,
    durationMs: Date.now() - startedAt,
    payloadBytes: bytes.byteLength,
  };
}

async function rpcOrThrow<T>(
  admin: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await admin.rpc(name, args);
  if (error) {
    throw new LegacyCatalogError("database_unavailable", `Falha segura na operação ${name}.`);
  }
  return data as T;
}

export async function persistLegacyCatalog({
  admin,
  catalog,
  batchSize = DEFAULT_LEGACY_BATCH_SIZE,
  maxBatches = Number.POSITIVE_INFINITY,
  now = Date.now,
}: BootstrapOptions): Promise<LegacyBootstrapResult> {
  const startedAt = now();
  const batches = splitLegacyCatalog(catalog.apps, batchSize);
  const claimData = await rpcOrThrow<ClaimRow[] | ClaimRow>(admin, "claim_legacy_public_applist", {
    p_source_hash: catalog.sourceHash,
    p_total_received: catalog.totalReceived,
    p_batch_size: batchSize,
    p_lease_seconds: 1_200,
  });
  const claim = (Array.isArray(claimData) ? claimData[0] : claimData) ?? null;
  if (!claim?.acquired || !claim.claim_token) {
    return {
      status: "already_running",
      resumed: false,
      startBatch: 0,
      lastBatch: -1,
      batchesProcessed: 0,
      received: catalog.totalReceived,
      rejected: catalog.totalRejected,
      persisted: 0,
      inserted: 0,
      updated: 0,
      ignored: 0,
      durationMs: now() - startedAt,
      sourceHash: catalog.sourceHash,
    };
  }

  let lastBatch = claim.start_batch - 1;
  let processedBatches = 0;
  let inserted = 0;
  let updated = 0;
  let ignored = 0;
  let persisted = 0;

  try {
    for (let batchIndex = claim.start_batch; batchIndex < batches.length; batchIndex += 1) {
      if (processedBatches >= maxBatches) break;
      const resultData = await rpcOrThrow<BatchResultRow[] | BatchResultRow>(
        admin,
        "upsert_legacy_public_applist_batch",
        {
          p_claim_token: claim.claim_token,
          p_batch_index: batchIndex,
          p_apps: batches[batchIndex],
        },
      );
      const row = (Array.isArray(resultData) ? resultData[0] : resultData) ?? ({} as BatchResultRow);
      inserted += safeNumber(row.inserted_count);
      updated += safeNumber(row.updated_count);
      ignored += safeNumber(row.ignored_count);
      persisted += safeNumber(row.persisted_count);
      lastBatch = batchIndex;
      processedBatches += 1;
    }

    const complete = lastBatch >= batches.length - 1;
    if (complete) {
      const finished = await rpcOrThrow<boolean>(admin, "finish_legacy_public_applist", {
        p_claim_token: claim.claim_token,
        p_total_failed: 0,
      });
      if (!finished) throw new LegacyCatalogError("database_unavailable", "Falha ao concluir o bootstrap legado.");
    } else {
      const paused = await rpcOrThrow<boolean>(admin, "pause_legacy_public_applist", {
        p_claim_token: claim.claim_token,
      });
      if (!paused) throw new LegacyCatalogError("database_unavailable", "Falha ao salvar a pausa do bootstrap legado.");
    }

    return {
      status: complete ? "complete_legacy" : "partial",
      resumed: Boolean(claim.resumed),
      startBatch: claim.start_batch,
      lastBatch,
      batchesProcessed: processedBatches,
      received: catalog.totalReceived,
      rejected: catalog.totalRejected,
      persisted,
      inserted,
      updated,
      ignored,
      durationMs: now() - startedAt,
      sourceHash: catalog.sourceHash,
    };
  } catch (error) {
    await admin.rpc("fail_legacy_public_applist", {
      p_claim_token: claim.claim_token,
      p_safe_error: error instanceof LegacyCatalogError ? error.message : "Falha ao persistir catálogo legado.",
    });
    throw error;
  }
}
