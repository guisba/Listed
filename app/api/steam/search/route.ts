import { NextRequest, NextResponse } from "next/server";
import { parseSteamInput } from "@/lib/steam/input";
import { resolveSteamGame } from "@/lib/steam/cache";
import { SteamError } from "@/lib/steam/errors";
import { consumeSteamRateLimit } from "@/lib/steam/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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
      return NextResponse.json({ source: game.cacheState, kind: "preview", games: [game] });
    }

    const { data, error } = await supabase.rpc("search_steam_apps", {
      search_query: parsed.query,
      result_limit: 8,
    });
    if (error) throw new SteamError("cache_unavailable", 503, { cause: error });
    const games = (data ?? []).map((row: Record<string, unknown>) => ({
      appid: Number(row.appid),
      name: String(row.name),
      type: String(row.app_type ?? "game"),
      id: typeof row.catalog_game_id === "string" ? row.catalog_game_id : null,
      headerImage: typeof row.header_image === "string" ? row.header_image : null,
      metadataStatus: row.metadata_status ?? null,
      cacheExpiresAt: row.cache_expires_at ?? null,
    }));
    return NextResponse.json({ source: "index", kind: "matches", games });
  } catch (error) {
    if (error instanceof SteamError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Entrada inválida.";
    return NextResponse.json({ error: message, code: "invalid_input" }, { status: 400 });
  }
}
