import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isFeatureEnabled } from "@/lib/env";
import { SteamError } from "@/lib/steam/errors";
import { getSteamCatalogStatus, runSteamCatalogSync, type SteamSyncMode } from "@/lib/steam/catalog-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const querySchema = z.object({
  mode: z.enum(["auto", "full", "incremental"]).default("auto"),
  pages: z.coerce.number().int().min(1).max(100).optional(),
  restart: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
});

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

async function runSync(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!isFeatureEnabled("STEAM_CATALOG_SYNC_ENABLED")) {
    return NextResponse.json({ error: "Sincronização Steam desativada." }, { status: 503 });
  }

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Parâmetros de sincronização inválidos." }, { status: 400 });

  try {
    const current = await getSteamCatalogStatus();
    const mode: SteamSyncMode = parsed.data.mode === "auto"
      ? (current.catalogComplete ? "incremental" : "full")
      : parsed.data.mode;
    const result = await runSteamCatalogSync({
      mode,
      restart: parsed.data.restart,
      maxPages: parsed.data.pages,
      triggerSource: request.headers.has("x-vercel-cron") ? "cron" : "manual",
    });
    return NextResponse.json(result, { status: result.status === "already_running" ? 409 : 200 });
  } catch (error) {
    const safeError = error instanceof SteamError ? error : new SteamError("cache_unavailable", 503, { cause: error });
    return NextResponse.json({ error: safeError.message, code: safeError.code }, { status: safeError.status });
  }
}

export const GET = runSync;
export const POST = runSync;
