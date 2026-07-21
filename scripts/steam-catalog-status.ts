import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secretKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL e SUPABASE_SECRET_KEY são obrigatórias.");
  }
  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const [{ data: state, error: stateError }, { count, error: countError }] = await Promise.all([
    admin
      .from("steam_catalog_sync_state")
      .select("status,provider,last_completed_at,total_indexed,catalog_complete,last_appid_checkpoint,last_page_size,last_error")
      .eq("singleton", true)
      .single(),
    admin.from("steam_app_index").select("appid", { count: "exact", head: true }).eq("is_available", true),
  ]);
  if (stateError || countError || !state) throw new Error("Não foi possível consultar o estado do catálogo.");
  process.stdout.write(`${JSON.stringify({
    totalIndexed: count ?? state.total_indexed ?? 0,
    provider: state.provider,
    lastSyncAt: state.last_completed_at,
    status: state.status,
    hasError: Boolean(state.last_error),
    progress: {
      complete: state.catalog_complete,
      checkpoint: state.last_appid_checkpoint,
      lastPageSize: state.last_page_size,
    },
  })}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${JSON.stringify({
    code: "status_unavailable",
    message: error instanceof Error ? error.message : "Falha ao consultar o catálogo.",
  })}\n`);
  process.exitCode = 1;
});
