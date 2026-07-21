import { createClient } from "@supabase/supabase-js";

import {
  DEFAULT_LEGACY_BATCH_SIZE,
  LegacyCatalogError,
  LegacyPublicAppListProvider,
  persistLegacyCatalog,
} from "./steam-catalog-legacy";

function numberArgument(name: string, fallback: number) {
  const entry = process.argv.find((value) => value.startsWith(`--${name}=`));
  if (!entry) return fallback;
  const parsed = Number(entry.slice(name.length + 3));
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`Argumento --${name} inválido.`);
  return parsed;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const batchSize = numberArgument("batch-size", DEFAULT_LEGACY_BATCH_SIZE);
  const maxBatches = numberArgument("max-batches", Number.MAX_SAFE_INTEGER);
  const catalog = await new LegacyPublicAppListProvider().download();

  const downloadSummary = {
    provider: "legacy_public_applist",
    statusHttp: catalog.status,
    contentType: catalog.contentType,
    totalReceived: catalog.totalReceived,
    totalValid: catalog.apps.length,
    totalRejected: catalog.totalRejected,
    durationMs: catalog.durationMs,
    dryRun,
  };
  process.stdout.write(`${JSON.stringify(downloadSummary)}\n`);
  if (dryRun) return;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secretKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL e SUPABASE_SECRET_KEY são obrigatórias.");
  }
  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const result = await persistLegacyCatalog({ admin, catalog, batchSize, maxBatches });
  process.stdout.write(`${JSON.stringify({
    provider: "legacy_public_applist",
    status: result.status,
    resumed: result.resumed,
    startBatch: result.startBatch,
    lastBatch: result.lastBatch,
    batchesProcessed: result.batchesProcessed,
    received: result.received,
    rejected: result.rejected,
    persisted: result.persisted,
    inserted: result.inserted,
    updated: result.updated,
    ignored: result.ignored,
    durationMs: result.durationMs,
  })}\n`);
}

main().catch((error: unknown) => {
  const safe = error instanceof LegacyCatalogError
    ? { code: error.code, statusHttp: error.httpStatus ?? null, message: error.message }
    : { code: "bootstrap_failed", message: error instanceof Error ? error.message : "Falha no bootstrap." };
  process.stderr.write(`${JSON.stringify(safe)}\n`);
  process.exitCode = 1;
});
