import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!expected || authorization !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Backend não configurado." }, { status: 503 });

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "true";
  const { data, error } = await admin.rpc("cleanup_expired_sessions", {
    dry_run: dryRun,
    batch_size: 100,
  });
  if (error) return NextResponse.json({ error: "Falha na limpeza." }, { status: 500 });
  return NextResponse.json({ ok: true, processed: data, dryRun });
}
