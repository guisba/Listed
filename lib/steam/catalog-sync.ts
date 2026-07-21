import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSteamCatalogPage, type CatalogPageOptions, type SteamCatalogPage } from "./catalog-provider";
import { SteamError } from "./errors";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizeName } from "@/lib/utils";

export type SteamSyncMode = "full" | "incremental";
export type SteamSyncTrigger = "manual" | "cron" | "admin";

interface ClaimRow {
  acquired: boolean;
  sync_mode: SteamSyncMode;
  start_cursor: number;
  modified_since: number;
  generation: string | null;
  claim_token: string | null;
}

interface ExistingIndexRow {
  appid: number;
  name: string;
  last_modified: number | null;
  price_change_number: number | null;
  is_available: boolean;
  source: "official_store_service" | "legacy_public_applist" | "individual_lookup";
}

export interface SteamCatalogStatus {
  status: "empty" | "idle" | "running" | "syncing" | "complete" | "partial" | "complete_legacy" | "complete_official" | "failed";
  mode: SteamSyncMode;
  catalogComplete: boolean;
  indexedGames: number;
  lastCheckpoint: number;
  lastPageSize: number;
  bootstrapStartedAt: string | null;
  bootstrapCompletedAt: string | null;
  lastFullSyncAt: string | null;
  lastIncrementalSyncAt: string | null;
  lastSyncAt: string | null;
  hasError: boolean;
  running: boolean;
  provider: "official_store_service" | "legacy_public_applist";
}

export interface SteamSyncResult {
  status: "complete" | "partial" | "already_running";
  mode: SteamSyncMode;
  pagesProcessed: number;
  received: number;
  inserted: number;
  updated: number;
  ignored: number;
  errors: number;
  checkpoint: number;
  durationMs: number;
  catalogComplete: boolean;
}

interface SyncOptions {
  mode: SteamSyncMode;
  triggerSource: SteamSyncTrigger;
  restart?: boolean;
  maxPages?: number;
  pageSize?: number;
  timeBudgetMs?: number;
  admin?: SupabaseClient;
  fetchPage?: (options: CatalogPageOptions) => Promise<SteamCatalogPage>;
  now?: () => number;
}

const INDEX_SELECT = "appid,name,last_modified,price_change_number,is_available,source";
const STATE_SELECT = "status,sync_mode,catalog_complete,total_indexed,last_appid_checkpoint,last_page_size,bootstrap_started_at,bootstrap_completed_at,last_full_sync_at,last_incremental_sync_at,last_completed_at,last_error,lease_expires_at,provider";

function asNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export async function getSteamCatalogStatus(admin = getSupabaseAdmin()): Promise<SteamCatalogStatus> {
  if (!admin) throw new SteamError("sync_not_configured", 503);
  const { data, error } = await admin
    .from("steam_catalog_sync_state")
    .select(STATE_SELECT)
    .eq("singleton", true)
    .single();
  if (error || !data) throw new SteamError("cache_unavailable", 503, { cause: error });
  const leaseActive = typeof data.lease_expires_at === "string" && Date.parse(data.lease_expires_at) > Date.now();
  return {
    status: data.status as SteamCatalogStatus["status"],
    mode: data.sync_mode as SteamSyncMode,
    catalogComplete: Boolean(data.catalog_complete),
    indexedGames: asNumber(data.total_indexed),
    lastCheckpoint: asNumber(data.last_appid_checkpoint),
    lastPageSize: asNumber(data.last_page_size),
    bootstrapStartedAt: data.bootstrap_started_at as string | null,
    bootstrapCompletedAt: data.bootstrap_completed_at as string | null,
    lastFullSyncAt: data.last_full_sync_at as string | null,
    lastIncrementalSyncAt: data.last_incremental_sync_at as string | null,
    lastSyncAt: data.last_completed_at as string | null,
    hasError: Boolean(data.last_error),
    running: (data.status === "running" || data.status === "syncing") && leaseActive,
    provider: data.provider as SteamCatalogStatus["provider"],
  };
}

function pageRows(page: SteamCatalogPage, mode: SteamSyncMode, generation: string | null, syncedAt: string) {
  return page.apps
    .filter((app) => Number.isInteger(app.appid) && app.appid > 0 && app.name?.trim())
    .map((app) => ({
      appid: app.appid,
      name: app.name.trim(),
      normalized_name: normalizeName(app.name),
      app_type: "game",
      catalog_type: "game",
      source: "official_store_service",
      catalog_source: "official_store_service",
      last_modified: app.last_modified || null,
      price_change_number: app.price_change_number || null,
      is_available: true,
      updated_at: syncedAt,
      synced_at: syncedAt,
      indexed_at: syncedAt,
      last_seen_generation: mode === "full" ? generation : undefined,
    }));
}

async function persistPage(admin: SupabaseClient, rows: ReturnType<typeof pageRows>) {
  let inserted = 0;
  let updated = 0;
  let ignored = 0;

  for (let offset = 0; offset < rows.length; offset += 250) {
    const chunk = rows.slice(offset, offset + 250);
    const appids = chunk.map((row) => row.appid);
    const { data: existing, error: readError } = await admin
      .from("steam_app_index")
      .select(INDEX_SELECT)
      .in("appid", appids);
    if (readError) throw new SteamError("cache_unavailable", 503, { cause: readError });

    const current = new Map((existing as ExistingIndexRow[] | null ?? []).map((row) => [Number(row.appid), row]));
    for (const row of chunk) {
      const previous = current.get(row.appid);
      if (!previous) inserted += 1;
      else if (
        previous.name !== row.name
        || asNumber(previous.last_modified) !== asNumber(row.last_modified)
        || asNumber(previous.price_change_number) !== asNumber(row.price_change_number)
        || !previous.is_available
      ) updated += 1;
      else ignored += 1;
    }

    const writeChunk = chunk.map((row) => current.get(row.appid)?.source === "individual_lookup"
      ? { ...row, source: "individual_lookup" as const }
      : row);
    const { error: writeError } = await admin
      .from("steam_app_index")
      .upsert(writeChunk, { onConflict: "appid" });
    if (writeError) throw new SteamError("cache_unavailable", 503, { cause: writeError });
  }

  return { inserted, updated, ignored };
}

async function updateRun(admin: SupabaseClient, runId: string | null, values: Record<string, unknown>) {
  if (!runId) return;
  await admin.from("steam_catalog_sync_runs").update(values).eq("id", runId);
}

export async function validateSteamCatalogKey(fetchPage = fetchSteamCatalogPage) {
  await fetchPage({ lastAppId: 0, ifModifiedSince: 0, maxResults: 1 });
  return true;
}

export async function runSteamCatalogSync({
  mode,
  triggerSource,
  restart = false,
  maxPages = Number.POSITIVE_INFINITY,
  pageSize = 5_000,
  timeBudgetMs = 240_000,
  admin = getSupabaseAdmin() ?? undefined,
  fetchPage = fetchSteamCatalogPage,
  now = Date.now,
}: SyncOptions): Promise<SteamSyncResult> {
  if (!admin || !process.env.STEAM_WEB_API_KEY) throw new SteamError("sync_not_configured", 503);

  const startedAt = now();
  const leaseSeconds = Math.min(600, Math.max(30, Math.ceil(timeBudgetMs / 1_000) + 30));
  const { data: claimData, error: claimError } = await admin.rpc("claim_steam_catalog_sync", {
    requested_mode: mode,
    requested_restart: restart,
    lease_seconds: leaseSeconds,
  });
  if (claimError) throw new SteamError("cache_unavailable", 503, { cause: claimError });
  const claim = (Array.isArray(claimData) ? claimData[0] : claimData) as ClaimRow | null;
  if (!claim?.acquired || !claim.claim_token) {
    return { status: "already_running", mode, pagesProcessed: 0, received: 0, inserted: 0, updated: 0, ignored: 0, errors: 0, checkpoint: 0, durationMs: now() - startedAt, catalogComplete: false };
  }

  let cursor = asNumber(claim.start_cursor);
  let pagesProcessed = 0;
  let received = 0;
  let inserted = 0;
  let updated = 0;
  let ignored = 0;
  let reachedEnd = false;
  const modifiedSince = mode === "incremental" ? asNumber(claim.modified_since) : 0;
  const nextModifiedCheckpoint = Math.floor(startedAt / 1_000);

  const { data: run, error: runError } = await admin.from("steam_catalog_sync_runs").insert({
    trigger_source: triggerSource === "cron" ? "cron" : "manual",
    mode,
    start_appid: cursor,
    initial_cursor: cursor,
    lock_token: claim.claim_token,
    provider: "official_store_service",
  }).select("id").single();
  if (runError) {
    await admin.rpc("fail_steam_catalog_sync", { claim_token: claim.claim_token, safe_error: "Falha ao registrar a execução." });
    throw new SteamError("cache_unavailable", 503, { cause: runError });
  }

  try {
    while (pagesProcessed < maxPages && now() - startedAt < timeBudgetMs) {
      const page = await fetchPage({ lastAppId: cursor, ifModifiedSince: modifiedSince, maxResults: pageSize });
      const rows = pageRows(page, mode, claim.generation, new Date(now()).toISOString());
      const previousCursor = cursor;
      const persisted = await persistPage(admin, rows);
      const invalidItems = asNumber(page.invalid_items);
      const rawPageSize = rows.length + invalidItems;
      received += rawPageSize;
      inserted += persisted.inserted;
      updated += persisted.updated;
      ignored += persisted.ignored + invalidItems;
      pagesProcessed += 1;

      const pageCursor = asNumber(page.last_appid || rows.at(-1)?.appid || cursor);
      cursor = pageCursor;
      reachedEnd = !page.have_more_results || rawPageSize === 0 || pageCursor <= previousCursor;

      const { data: checkpointed, error: checkpointError } = await admin.rpc("checkpoint_steam_catalog_sync", {
        claim_token: claim.claim_token,
        requested_mode: mode,
        next_cursor: cursor,
        page_size: rawPageSize,
        received_delta: rawPageSize,
      });
      if (checkpointError || checkpointed !== true) {
        throw new SteamError("cache_unavailable", 503, { cause: checkpointError });
      }
      if (reachedEnd) break;
    }

    const durationMs = now() - startedAt;
    const { data: finished, error: finishError } = await admin.rpc("finish_steam_catalog_sync", {
      claim_token: claim.claim_token,
      requested_mode: mode,
      reached_end: reachedEnd,
      final_cursor: cursor,
      modified_checkpoint: nextModifiedCheckpoint,
    });
    if (finishError || finished !== true) throw new SteamError("cache_unavailable", 503, { cause: finishError });

    await updateRun(admin, run?.id ?? null, {
      status: reachedEnd ? "complete" : "partial",
      end_appid: cursor,
      final_cursor: cursor,
      pages_processed: pagesProcessed,
      apps_processed: received,
      received_count: received,
      inserted_count: inserted,
      updated_count: updated,
      ignored_count: ignored,
      duration_ms: durationMs,
      completed_at: new Date(now()).toISOString(),
    });

    return {
      status: reachedEnd ? "complete" : "partial",
      mode,
      pagesProcessed,
      received,
      inserted,
      updated,
      ignored,
      errors: 0,
      checkpoint: reachedEnd ? 0 : cursor,
      durationMs,
      catalogComplete: mode === "full" && reachedEnd,
    };
  } catch (error) {
    const safeError = error instanceof SteamError ? error.message : "Falha ao salvar o catálogo Steam.";
    const durationMs = now() - startedAt;
    await admin.rpc("fail_steam_catalog_sync", { claim_token: claim.claim_token, safe_error: safeError });
    await updateRun(admin, run?.id ?? null, {
      status: "failed",
      end_appid: cursor,
      final_cursor: cursor,
      pages_processed: pagesProcessed,
      apps_processed: received,
      received_count: received,
      inserted_count: inserted,
      updated_count: updated,
      ignored_count: ignored,
      duration_ms: durationMs,
      errors: [{ message: safeError, at: new Date(now()).toISOString() }],
      completed_at: new Date(now()).toISOString(),
    });
    throw error;
  }
}
