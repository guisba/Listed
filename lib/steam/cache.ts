import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isFeatureEnabled } from "@/lib/env";
import { normalizeName } from "@/lib/utils";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SteamError, toSteamError } from "./errors";
import { SteamStoreProvider } from "./store-provider";
import type { SteamGame, SteamGamePreview } from "./types";

const COMPLETE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
const PARTIAL_TTL_MS = 12 * 60 * 60 * 1_000;

type CatalogRow = Record<string, unknown>;

function textArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function catalogRowToPreview(row: CatalogRow, cacheState: SteamGamePreview["cacheState"]): SteamGamePreview {
  return {
    id: typeof row.id === "string" ? row.id : null,
    appid: Number(row.steam_appid),
    name: String(row.name),
    type: typeof row.app_type === "string" ? row.app_type : "game",
    storeUrl: typeof row.store_url === "string" ? row.store_url : `https://store.steampowered.com/app/${row.steam_appid}/`,
    headerImage: typeof row.header_image === "string" ? row.header_image : null,
    coverImage: typeof row.cover_image === "string" ? row.cover_image : null,
    shortDescription: typeof row.short_description === "string" ? row.short_description : null,
    fullDescription: typeof row.full_description === "string" ? row.full_description : null,
    releaseDate: typeof row.release_date === "string" ? row.release_date : null,
    comingSoon: Boolean(row.coming_soon),
    platforms: textArray(row.platforms),
    genres: textArray(row.genres),
    categories: textArray(row.categories),
    features: textArray(row.features),
    developers: textArray(row.developers),
    publishers: textArray(row.publishers),
    supportedLanguages: textArray(row.supported_languages),
    price: row.price && typeof row.price === "object" ? row.price as SteamGame["price"] : null,
    isFree: Boolean(row.is_free),
    metadataStatus: ["pending", "complete", "partial", "failed", "stale"].includes(String(row.metadata_status))
      ? row.metadata_status as SteamGame["metadataStatus"]
      : "partial",
    cacheState,
  };
}

function providerPreview(game: SteamGame, id: string | null, cacheState: SteamGamePreview["cacheState"]): SteamGamePreview {
  return { ...game, id, cacheState };
}

async function persistSteamGame(game: SteamGame) {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const now = new Date();
  const ttl = game.metadataStatus === "complete" ? COMPLETE_TTL_MS : PARTIAL_TTL_MS;
  const { data, error } = await admin
    .from("catalog_games")
    .upsert({
      steam_appid: game.appid,
      source: "steam",
      name: game.name,
      normalized_name: normalizeName(game.name),
      app_type: game.type,
      store_url: game.storeUrl,
      header_image: game.headerImage,
      cover_image: game.coverImage,
      short_description: game.shortDescription,
      full_description: game.fullDescription,
      platforms: game.platforms,
      genres: game.genres,
      categories: game.categories,
      features: game.features,
      developers: game.developers,
      publishers: game.publishers,
      supported_languages: game.supportedLanguages,
      price: game.price,
      release_date: game.releaseDate,
      coming_soon: game.comingSoon,
      is_free: game.isFree,
      metadata_status: game.metadataStatus,
      raw_metadata: game,
      metadata_updated_at: now.toISOString(),
      last_import_attempt_at: now.toISOString(),
      last_import_error: null,
      cache_expires_at: new Date(now.getTime() + ttl).toISOString(),
    }, { onConflict: "steam_appid" })
    .select("id")
    .single();
  if (error) throw new SteamError("cache_unavailable", 503, { cause: error });

  const { error: indexError } = await admin.from("steam_app_index").upsert({
    appid: game.appid,
    name: game.name,
    normalized_name: normalizeName(game.name),
    app_type: game.type,
    catalog_type: game.type,
    source: "individual_lookup",
    is_available: true,
    synced_at: now.toISOString(),
    updated_at: now.toISOString(),
    indexed_at: now.toISOString(),
  }, { onConflict: "appid" });
  if (indexError) throw new SteamError("cache_unavailable", 503, { cause: indexError });

  // Individual AppID/link hydration happens outside the catalog synchronizer,
  // so keep its diagnostic total aligned with the searchable index as well.
  const { count: indexedGames, error: countError } = await admin
    .from("steam_app_index")
    .select("appid", { count: "exact", head: true })
    .eq("is_available", true);
  if (!countError && indexedGames !== null) {
    await admin
      .from("steam_catalog_sync_state")
      .update({ total_indexed: indexedGames, updated_at: now.toISOString() })
      .eq("singleton", true);
  }
  return data?.id as string | null;
}

async function markImportFailure(appid: number, error: Error) {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  await admin.from("catalog_games").update({
    metadata_status: "stale",
    last_import_attempt_at: new Date().toISOString(),
    last_import_error: error.message.slice(0, 500),
  }).eq("steam_appid", appid);
}

export async function resolveSteamGame(appid: number, supabase: SupabaseClient) {
  const { data: cached, error } = await supabase
    .from("catalog_games")
    .select("*")
    .eq("steam_appid", appid)
    .maybeSingle();
  if (error) throw new SteamError("cache_unavailable", 503, { cause: error });

  const fresh = cached
    && cached.metadata_status === "complete"
    && typeof cached.cache_expires_at === "string"
    && Date.parse(cached.cache_expires_at) > Date.now();
  if (fresh) return catalogRowToPreview(cached, "fresh");

  if (!isFeatureEnabled("STEAM_PROVIDER_ENABLED")) {
    if (cached) {
      return {
        ...catalogRowToPreview(cached, "stale"),
        warning: "Detalhes em cache podem estar desatualizados; a atualização Steam está desativada.",
      };
    }
    throw new SteamError("provider_disabled", 503);
  }

  try {
    const game = await new SteamStoreProvider().getApp(appid);
    if (!game) throw new SteamError("not_found", 404);
    const id = await persistSteamGame(game);
    return providerPreview(game, id, cached ? "refreshed" : "uncached");
  } catch (providerError) {
    const normalized = toSteamError(providerError);
    await markImportFailure(appid, normalized);
    if (cached) {
      return {
        ...catalogRowToPreview(cached, "stale"),
        metadataStatus: "stale" as const,
        warning: "A Steam não respondeu; exibindo a última versão salva.",
      };
    }
    throw normalized;
  }
}
