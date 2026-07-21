import { NextRequest, NextResponse } from "next/server";
import { parseSteamInput } from "@/lib/steam/input";
import { resolveSteamGame } from "@/lib/steam/cache";
import { SteamError } from "@/lib/steam/errors";
import { safeSteamImageUrl, type SteamImageStatus } from "@/lib/steam/image";
import { consumeSteamRateLimit } from "@/lib/steam/rate-limit";
import { getSteamCatalogStatus } from "@/lib/steam/catalog-sync";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function catalogMetadata() {
  try {
    const status = await getSteamCatalogStatus();
    return {
      status: status.catalogComplete
        ? "complete" as const
        : status.status === "running" || status.status === "syncing"
          ? "syncing" as const
          : status.status === "failed"
            ? "failed" as const
            : status.indexedGames === 0
              ? "empty" as const
              : "partial" as const,
      provider: status.provider,
      indexedGames: status.indexedGames,
      lastSyncAt: status.lastSyncAt,
    };
  } catch {
    return { status: "unknown" as const, indexedGames: 0, lastSyncAt: null };
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const rate = consumeSteamRateLimit(`search:${auth.user.id}`);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Muitas buscas em pouco tempo. Aguarde alguns segundos e tente novamente.", code: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    );
  }

  try {
    const parsed = parseSteamInput(request.nextUrl.searchParams.get("q") ?? "");
    if (parsed.kind === "appid") {
      const game = await resolveSteamGame(parsed.appid, supabase);
      return NextResponse.json({ source: game.cacheState, kind: "preview", games: [game], catalog: await catalogMetadata() });
    }

    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit") ?? 12), 1), 20);
    const offset = Math.min(Math.max(Number(request.nextUrl.searchParams.get("offset") ?? 0), 0), 1_000);

    const { data, error } = await supabase.rpc("search_steam_apps", {
      search_query: parsed.query,
      result_limit: limit,
      result_offset: offset,
    });
    if (error) throw new SteamError("cache_unavailable", 503, { cause: error });
    const games = (data ?? []).map((row: Record<string, unknown>) => ({
      appid: Number(row.appid),
      name: String(row.name),
      type: String(row.app_type ?? "game"),
      id: typeof row.catalog_game_id === "string" ? row.catalog_game_id : null,
      capsuleImageUrl: safeSteamImageUrl(row.capsule_image_url),
      headerImage: safeSteamImageUrl(row.header_image_url),
      imageStatus: (["unknown", "available", "missing", "failed", "stale"] as SteamImageStatus[]).includes(row.image_status as SteamImageStatus)
        ? row.image_status as SteamImageStatus
        : "unknown",
      releaseDate: typeof row.release_date === "string" ? row.release_date : null,
      platforms: Array.isArray(row.platforms) ? row.platforms.filter((value): value is string => typeof value === "string") : [],
      metadataStatus: row.metadata_status ?? null,
      cacheExpiresAt: row.cache_expires_at ?? null,
      relevance: Number(row.text_relevance_score ?? 0),
      matchKind: typeof row.match_kind === "string" ? row.match_kind : undefined,
      source: typeof row.catalog_source === "string" ? row.catalog_source : "individual_lookup",
    }));
    const total = Number((data?.[0] as Record<string, unknown> | undefined)?.total_matches ?? games.length);
    return NextResponse.json({
      source: "index",
      kind: "matches",
      games,
      pagination: { limit, offset, total, hasMore: offset + games.length < total },
      catalog: await catalogMetadata(),
    });
  } catch (error) {
    if (error instanceof SteamError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Entrada inválida.";
    return NextResponse.json({ error: message, code: "invalid_input" }, { status: 400 });
  }
}
