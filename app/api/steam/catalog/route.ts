import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSteamCatalogStatus, runSteamCatalogSync } from "@/lib/steam/catalog-sync";
import { SteamError } from "@/lib/steam/errors";
import { validateSteamCatalogHosts, validateSteamPublicCatalogPage } from "@/lib/steam/catalog-provider";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const actionSchema = z.object({
  action: z.enum(["continue_bootstrap", "run_incremental", "reprocess_failures", "validate_provider_hosts", "validate_public_page"]),
  pages: z.number().int().min(1).max(100).optional(),
  cursor: z.number().int().nonnegative().optional(),
  pageSize: z.number().int().min(1).max(5_000).optional(),
});

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

function safeErrorResponse(error: unknown) {
  const safe = error instanceof SteamError ? error : new SteamError("cache_unavailable", 503, { cause: error });
  return NextResponse.json({ error: safe.message, code: safe.code }, { status: safe.status });
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try {
    return NextResponse.json(await getSteamCatalogStatus());
  } catch (error) {
    return safeErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Ação administrativa inválida." }, { status: 400 });

  try {
    if (parsed.data.action === "validate_provider_hosts") {
      return NextResponse.json(await validateSteamCatalogHosts());
    }
    if (parsed.data.action === "validate_public_page") {
      return NextResponse.json(await validateSteamPublicCatalogPage(parsed.data.cursor ?? 0, parsed.data.pageSize ?? 10));
    }
    const mode = parsed.data.action === "run_incremental" ? "incremental" : "full";
    const result = await runSteamCatalogSync({
      mode,
      triggerSource: "admin",
      maxPages: parsed.data.pages,
      restart: false,
    });
    return NextResponse.json(result, { status: result.status === "already_running" ? 409 : 200 });
  } catch (error) {
    return safeErrorResponse(error);
  }
}
