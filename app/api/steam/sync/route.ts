import { NextRequest, NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/env";
import { fetchSteamCatalogPage } from "@/lib/steam/catalog-provider";
import { SteamError } from "@/lib/steam/errors";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizeName } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

async function runSync(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!isFeatureEnabled("STEAM_CATALOG_SYNC_ENABLED")) {
    return NextResponse.json({ error: "Sincronização Steam desativada." }, { status: 503 });
  }
  const admin = getSupabaseAdmin();
  if (!admin || !process.env.STEAM_WEB_API_KEY) {
    return NextResponse.json({ error: "Credenciais server-only não configuradas." }, { status: 503 });
  }

  const maxPages = Math.min(Math.max(Number(request.nextUrl.searchParams.get("pages") ?? 2), 1), 5);
  const triggerSource = request.headers.has("x-vercel-cron") ? "cron" : "manual";
  const { data: state, error: stateError } = await admin
    .from("steam_catalog_sync_state")
    .select("*")
    .eq("singleton", true)
    .single();
  if (stateError) return NextResponse.json({ error: "Checkpoint indisponível." }, { status: 503 });

  const startedAt = new Date().toISOString();
  const { data: run } = await admin.from("steam_catalog_sync_runs").insert({
    trigger_source: triggerSource,
    start_appid: state.last_appid,
  }).select("id").single();
  await admin.from("steam_catalog_sync_state").update({
    status: "running",
    last_error: null,
    last_started_at: startedAt,
    updated_at: startedAt,
  }).eq("singleton", true);

  let lastAppid = Number(state.last_appid ?? 0);
  let appsProcessed = 0;
  let pagesProcessed = 0;
  let complete = false;

  try {
    for (let pageNumber = 0; pageNumber < maxPages; pageNumber += 1) {
      const page = await fetchSteamCatalogPage({
        lastAppId: lastAppid,
        ifModifiedSince: Number(state.if_modified_since ?? 0),
        maxResults: 1_000,
      });
      const rows = page.apps
        .filter((app) => Number.isInteger(app.appid) && app.appid > 0 && app.name?.trim())
        .map((app) => ({
          appid: app.appid,
          name: app.name.trim(),
          normalized_name: normalizeName(app.name),
          app_type: "game",
          last_modified: app.last_modified || null,
          price_change_number: app.price_change_number || null,
          indexed_at: new Date().toISOString(),
        }));

      const chunks = Array.from({ length: Math.ceil(rows.length / 250) }, (_, index) => rows.slice(index * 250, (index + 1) * 250));
      const results = await Promise.all(chunks.map((chunk) => admin.from("steam_app_index").upsert(chunk, { onConflict: "appid" })));
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;

      appsProcessed += rows.length;
      pagesProcessed += 1;
      lastAppid = Number(page.last_appid || rows.at(-1)?.appid || lastAppid);
      complete = !page.have_more_results;
      await admin.from("steam_catalog_sync_state").update({
        last_appid: complete ? 0 : lastAppid,
        processed_apps: Number(state.processed_apps ?? 0) + appsProcessed,
        updated_at: new Date().toISOString(),
      }).eq("singleton", true);
      if (complete) break;
    }

    const finishedAt = new Date().toISOString();
    await admin.from("steam_catalog_sync_state").update({
      status: "idle",
      last_appid: complete ? 0 : lastAppid,
      if_modified_since: complete ? Math.floor(Date.now() / 1000) : Number(state.if_modified_since ?? 0),
      last_completed_at: complete ? finishedAt : state.last_completed_at,
      updated_at: finishedAt,
    }).eq("singleton", true);
    if (run?.id) await admin.from("steam_catalog_sync_runs").update({
      status: complete ? "complete" : "partial",
      end_appid: lastAppid,
      pages_processed: pagesProcessed,
      apps_processed: appsProcessed,
      completed_at: finishedAt,
    }).eq("id", run.id);

    return NextResponse.json({
      status: complete ? "complete" : "partial",
      pagesProcessed,
      appsProcessed,
      checkpoint: complete ? 0 : lastAppid,
    });
  } catch (error) {
    const safeError = error instanceof SteamError ? error.message : "Falha ao salvar o catálogo Steam.";
    const finishedAt = new Date().toISOString();
    await admin.from("steam_catalog_sync_state").update({
      status: "failed",
      last_appid: lastAppid,
      last_error: safeError,
      updated_at: finishedAt,
    }).eq("singleton", true);
    if (run?.id) await admin.from("steam_catalog_sync_runs").update({
      status: "failed",
      end_appid: lastAppid,
      pages_processed: pagesProcessed,
      apps_processed: appsProcessed,
      errors: [{ message: safeError, at: finishedAt }],
      completed_at: finishedAt,
    }).eq("id", run.id);
    return NextResponse.json({ error: safeError, checkpoint: lastAppid }, { status: error instanceof SteamError ? error.status : 500 });
  }
}

export const GET = runSync;
export const POST = runSync;
