import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase", "migrations", "20260720123940_initial_listed.sql"), "utf8");
const steamMigration = readFileSync(join(process.cwd(), "supabase", "migrations", "20260720225653_steam_catalog_pipeline.sql"), "utf8");
const fullCatalogMigration = readFileSync(join(process.cwd(), "supabase", "migrations", "20260721122538_steam_catalog_full_search.sql"), "utf8");
const presetRemovalMigration = readFileSync(join(process.cwd(), "supabase", "migrations", "20260721124406_remove_steam_runtime_presets.sql"), "utf8");
const legacyBootstrapMigration = readFileSync(join(process.cwd(), "supabase", "migrations", "20260721144016_add_legacy_public_applist_bootstrap.sql"), "utf8");
const seed = readFileSync(join(process.cwd(), "supabase", "seed.sql"), "utf8");
const exposedTables = ["profiles", "groups", "group_members", "sessions", "session_members", "session_invites", "catalog_games", "steam_app_index", "session_games", "votes", "game_ownership", "user_game_library", "decision_runs", "decision_results", "audit_logs"];

describe("database security migration", () => {
  it.each(exposedTables)("habilita RLS em %s", (table) => expect(migration).toContain(`alter table public.${table} enable row level security;`));
  it("não concede execução anônima aos RPCs privilegiados", () => expect(migration).toMatch(/revoke all on function public\.create_quick_session[\s\S]+from public, anon;/));
  it("mantém service role fora de variáveis públicas", () => expect(migration).not.toContain("NEXT_PUBLIC"));
  it("mantém estado e histórico do sync invisíveis ao cliente", () => {
    expect(steamMigration).toContain("alter table public.steam_catalog_sync_state enable row level security");
    expect(steamMigration).toContain("revoke all on public.steam_catalog_sync_state from public, anon, authenticated");
  });
  it("expõe somente busca invoker ao usuário autenticado", () => {
    expect(steamMigration).toMatch(/search_steam_apps[\s\S]+security invoker/);
    expect(steamMigration).toContain("grant execute on function public.search_steam_apps(text, integer) to authenticated");
  });
  it("protege operações do catálogo e usa checkpoints retomáveis", () => {
    expect(fullCatalogMigration).toContain("security invoker");
    expect(fullCatalogMigration).toContain("claim_steam_catalog_sync");
    expect(fullCatalogMigration).toContain("checkpoint_steam_catalog_sync");
    expect(fullCatalogMigration).toContain("lease_expires_at");
    expect(fullCatalogMigration).toMatch(/revoke all on function public\.claim_steam_catalog_sync[\s\S]+from public, anon, authenticated/);
  });
  it("protege o bootstrap legado e preserva a origem de detalhes", () => {
    expect(legacyBootstrapMigration).toMatch(/claim_legacy_public_applist[\s\S]+security invoker/);
    expect(legacyBootstrapMigration).toContain("grant execute on function public.upsert_legacy_public_applist_batch(uuid, integer, jsonb) to service_role");
    expect(legacyBootstrapMigration).toContain("when public.steam_app_index.source = 'individual_lookup' then public.steam_app_index.source");
    expect(legacyBootstrapMigration).toContain("catalog_source = excluded.catalog_source");
  });
  it("indexa busca por prefixo e similaridade sem presets no seed", () => {
    expect(fullCatalogMigration).toContain("text_pattern_ops");
    expect(fullCatalogMigration).toContain("gin_trgm_ops");
    expect(fullCatalogMigration).toContain("last_modified_checkpoint");
    expect(seed).not.toMatch(/Counter-Strike|Terraria|Left 4 Dead|Stardew Valley|Deep Rock/i);
    expect(presetRemovalMigration).toContain("delete from public.catalog_games");
    expect(presetRemovalMigration).toContain("metadata_updated_at is null");
  });
});
