import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isFeatureEnabled } from "@/lib/env";
import { parseSteamInput } from "@/lib/steam/input";
import { SteamStoreProvider } from "@/lib/steam/store-provider";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  }
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    const parsed = parseSteamInput(request.nextUrl.searchParams.get("q") ?? "");
    if (parsed.kind === "appid") {
      const { data: cached } = await supabase
        .from("catalog_games")
        .select("*")
        .eq("steam_appid", parsed.appid)
        .maybeSingle();
      if (cached) return NextResponse.json({ source: "cache", games: [cached] });

      if (!isFeatureEnabled("STEAM_PROVIDER_ENABLED")) {
        return NextResponse.json(
          { error: "Importação Steam está desativada; use a inclusão manual." },
          { status: 503 },
        );
      }
      const game = await new SteamStoreProvider().getApp(parsed.appid);
      return NextResponse.json({ source: "steam", games: game ? [game] : [] });
    }

    const { data, error } = await supabase.rpc("search_catalog_games", {
      search_query: parsed.query,
      result_limit: 8,
    });
    if (error) throw error;
    return NextResponse.json({ source: "catalog", games: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Busca indisponível.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
