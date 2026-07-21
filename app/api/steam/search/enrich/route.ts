import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveSteamGame } from "@/lib/steam/cache";
import { SteamError } from "@/lib/steam/errors";
import {
  isImageStatusFresh,
  safeSteamImageUrl,
  STEAM_IMAGE_ENRICH_BATCH_LIMIT,
  STEAM_IMAGE_ENRICH_CONCURRENCY,
  type SteamImageStatus,
} from "@/lib/steam/image";
import { consumeSteamRateLimit } from "@/lib/steam/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  appids: z.array(z.number().int().positive().max(9_999_999_999)).min(1).max(STEAM_IMAGE_ENRICH_BATCH_LIMIT),
}).strict();

interface EnrichedImage {
  appid: number;
  capsuleImageUrl: string | null;
  imageStatus: SteamImageStatus;
}

const pendingEnrichments = new Map<number, Promise<EnrichedImage>>();

async function persistImageState(result: EnrichedImage, headerImageUrl: string | null = null) {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  await admin.from("steam_app_index").update({
    capsule_image_url: result.capsuleImageUrl,
    header_image_url: headerImageUrl,
    image_source: result.capsuleImageUrl || headerImageUrl ? "individual_lookup" : null,
    image_status: result.imageStatus,
    image_updated_at: new Date().toISOString(),
  }).eq("appid", result.appid);
}

async function enrichAppid(appid: number, supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>): Promise<EnrichedImage> {
  const existing = pendingEnrichments.get(appid);
  if (existing) return existing;

  const task = (async () => {
    if (!supabase) return { appid, capsuleImageUrl: null, imageStatus: "failed" as const };
    try {
      const game = await resolveSteamGame(appid, supabase);
      const capsuleImageUrl = safeSteamImageUrl(game.capsuleImage ?? game.coverImage ?? game.headerImage);
      const headerImageUrl = safeSteamImageUrl(game.headerImage);
      const result: EnrichedImage = {
        appid,
        capsuleImageUrl,
        imageStatus: capsuleImageUrl ? "available" : "missing",
      };
      await persistImageState(result, headerImageUrl);
      return result;
    } catch (error) {
      const imageStatus: SteamImageStatus = error instanceof SteamError && error.code === "not_found" ? "missing" : "failed";
      const result = { appid, capsuleImageUrl: null, imageStatus };
      await persistImageState(result);
      return result;
    }
  })().finally(() => pendingEnrichments.delete(appid));

  pendingEnrichments.set(appid, task);
  return task;
}

async function mapWithConcurrency<T, R>(items: T[], worker: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(STEAM_IMAGE_ENRICH_CONCURRENCY, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  }));
  return results;
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const rate = consumeSteamRateLimit(`search-enrich:${auth.user.id}`, 12, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Muitas solicitações de imagens. Aguarde alguns segundos.", code: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 2_048) {
    return NextResponse.json({ error: "Payload muito grande." }, { status: 413 });
  }
  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "AppIDs inválidos." }, { status: 400 });
  const appids = [...new Set(parsed.data.appids)];

  const { data: cachedRows } = await supabase
    .from("steam_app_index")
    .select("appid,capsule_image_url,header_image_url,image_status,image_updated_at")
    .in("appid", appids);
  const cachedByAppid = new Map((cachedRows ?? []).map((row) => [Number(row.appid), row]));
  const immediate = new Map<number, EnrichedImage>();
  const pending: number[] = [];

  for (const appid of appids) {
    const row = cachedByAppid.get(appid);
    const imageUrl = safeSteamImageUrl(row?.capsule_image_url) ?? safeSteamImageUrl(row?.header_image_url);
    const imageStatus = String(row?.image_status ?? "unknown") as SteamImageStatus;
    const updatedAt = typeof row?.image_updated_at === "string" ? row.image_updated_at : null;
    if (imageUrl) immediate.set(appid, { appid, capsuleImageUrl: imageUrl, imageStatus: "available" });
    else if (isImageStatusFresh(imageStatus, updatedAt)) immediate.set(appid, { appid, capsuleImageUrl: null, imageStatus });
    else pending.push(appid);
  }

  const enriched = await mapWithConcurrency(pending, (appid) => enrichAppid(appid, supabase));
  for (const result of enriched) immediate.set(result.appid, result);

  return NextResponse.json({
    images: appids.map((appid) => immediate.get(appid) ?? { appid, capsuleImageUrl: null, imageStatus: "failed" }),
  });
}
