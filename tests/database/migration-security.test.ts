import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase", "migrations", "20260720123940_initial_listed.sql"), "utf8");
const steamMigration = readFileSync(join(process.cwd(), "supabase", "migrations", "20260720225653_steam_catalog_pipeline.sql"), "utf8");
const fullCatalogMigration = readFileSync(join(process.cwd(), "supabase", "migrations", "20260721122538_steam_catalog_full_search.sql"), "utf8");
const presetRemovalMigration = readFileSync(join(process.cwd(), "supabase", "migrations", "20260721124406_remove_steam_runtime_presets.sql"), "utf8");
const legacyBootstrapMigration = readFileSync(join(process.cwd(), "supabase", "migrations", "20260721144016_add_legacy_public_applist_bootstrap.sql"), "utf8");
const imageRankingMigration = readFileSync(join(process.cwd(), "supabase", "migrations", "20260721180000_steam_search_images_popularity.sql"), "utf8");
const recommendationMigration = readFileSync(join(process.cwd(), "supabase", "migrations", "20260721181000_steam_recommendations_popularity.sql"), "utf8");
const sessionEnumMigration = readFileSync(join(process.cwd(), "supabase", "migrations", "20260727140458_extend_session_roles_and_themes.sql"), "utf8");
const sessionAdminMigration = readFileSync(join(process.cwd(), "supabase", "migrations", "20260727140501_session_administration_security.sql"), "utf8");
const sessionFeatureRepairMigration = readFileSync(join(process.cwd(), "supabase", "migrations", "20260727140725_repair_session_game_features_by_appid.sql"), "utf8");
const sessionBanIndexMigration = readFileSync(join(process.cwd(), "supabase", "migrations", "20260727140851_index_session_ban_foreign_keys.sql"), "utf8");
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
  it("mantém sinais detalhados de popularidade privados e imagens limitadas", () => {
    expect(imageRankingMigration).toContain("private.steam_app_popularity");
    expect(imageRankingMigration).toContain("revoke all on table private.steam_app_popularity from public, anon, authenticated");
    expect(imageRankingMigration).toContain("popularity_score between 0 and 250");
    expect(imageRankingMigration).toContain("steam_app_index_image_refresh_idx");
    expect(recommendationMigration).toContain("security invoker");
    expect(recommendationMigration).toContain("grant execute on function public.record_steam_recommendations(bigint, bigint) to service_role");
    expect(recommendationMigration).toMatch(/revoke all on function public\.record_steam_recommendations[\s\S]+from public, anon, authenticated/);
  });

  it("protege administração de sessões por RLS e RPCs dedicadas", () => {
    expect(sessionAdminMigration).toContain("alter table public.session_settings enable row level security");
    expect(sessionAdminMigration).toContain("alter table public.session_bans enable row level security");
    expect(sessionAdminMigration).toContain("session_members_one_active_owner_idx");
    expect(sessionAdminMigration).toMatch(/transfer_session_ownership[\s\S]+for update/);
    expect(sessionAdminMigration).toMatch(/set_session_member_role[\s\S]+security definer[\s\S]+set search_path = ''/);
    expect(sessionAdminMigration).toMatch(/remove_session_member[\s\S]+delete from public\.votes[\s\S]+delete from public\.game_ownership/);
    expect(sessionAdminMigration).toContain("grant select on public.session_settings to authenticated");
    expect(sessionAdminMigration).toContain("grant select on public.session_bans to authenticated");
  });

  it("revoga acesso público aos fluxos administrativos", () => {
    for (const signature of [
      "set_session_member_role(uuid, uuid, public.member_role)",
      "remove_session_member(uuid, uuid, boolean, text)",
      "unban_session_member(uuid, uuid)",
      "transfer_session_ownership(uuid, uuid)",
      "update_session_status(uuid, public.session_status)",
      "remove_session_game(uuid, uuid)",
    ]) {
      expect(sessionAdminMigration).toContain(`revoke all on function public.${signature} from public, anon;`);
    }
  });

  it("mantém compatibilidade de papéis e cria configurações para sessões existentes", () => {
    expect(sessionEnumMigration).toContain("add value if not exists 'co_owner'");
    expect(sessionEnumMigration).not.toContain("rename value 'moderator'");
    expect(sessionAdminMigration).toMatch(/insert into public\.session_settings\(session_id\)[\s\S]+select id from public\.sessions/);
    expect(sessionAdminMigration).toContain("Acesso bloqueado nesta sessão");
  });

  it("repara recursos históricos por AppID sem depender do vínculo de cache", () => {
    expect(sessionFeatureRepairMigration).toContain("sg.steam_appid = cg.steam_appid");
    expect(sessionFeatureRepairMigration).toContain("catalog_game_id = coalesce(sg.catalog_game_id, cg.id)");
    expect(sessionFeatureRepairMigration).toContain("sg.source = 'steam'");
  });

  it("indexa todas as FKs operacionais de banimento", () => {
    expect(sessionBanIndexMigration).toContain("session_bans_user_id_idx");
    expect(sessionBanIndexMigration).toContain("session_bans_banned_by_idx");
    expect(sessionBanIndexMigration).toContain("session_bans_revoked_by_idx");
  });
});
