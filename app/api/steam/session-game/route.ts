import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveSteamGame } from "@/lib/steam/cache";
import { SteamError } from "@/lib/steam/errors";
import { consumeSteamRateLimit } from "@/lib/steam/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeName } from "@/lib/utils";

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  appid: z.number().int().positive().max(9_999_999_999),
});

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!consumeSteamRateLimit(`add:${auth.user.id}`, 12).allowed) {
    return NextResponse.json({ error: "Muitas inclusões em pouco tempo." }, { status: 429 });
  }

  try {
    const body = bodySchema.parse(await request.json());
    const game = await resolveSteamGame(body.appid, supabase);
    const { error } = await supabase.from("session_games").insert({
      session_id: body.sessionId,
      source: "steam",
      steam_appid: game.appid,
      catalog_game_id: game.id,
      name: game.name,
      normalized_name: normalizeName(game.name),
      image_url: game.headerImage,
      store_url: game.storeUrl,
      platforms: game.platforms,
      features: game.features,
      tags: [...new Set([...game.genres, ...game.features])].slice(0, 30),
      description: game.shortDescription,
      added_by: auth.user.id,
    });
    if (error?.code === "23505") {
      return NextResponse.json({ error: "Esse jogo já está na sessão.", code: "duplicate" }, { status: 409 });
    }
    if (error) return NextResponse.json({ error: "Você não pode adicionar jogos a esta sessão." }, { status: 403 });
    return NextResponse.json({ game }, { status: 201 });
  } catch (error) {
    if (error instanceof SteamError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Sessão ou AppID inválido." }, { status: 400 });
    }
    return NextResponse.json({ error: "Não foi possível adicionar o jogo." }, { status: 500 });
  }
}
