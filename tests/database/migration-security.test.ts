import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase", "migrations", "20260720123940_initial_listed.sql"), "utf8");
const exposedTables = ["profiles", "groups", "group_members", "sessions", "session_members", "session_invites", "catalog_games", "steam_app_index", "session_games", "votes", "game_ownership", "user_game_library", "decision_runs", "decision_results", "audit_logs"];

describe("database security migration", () => {
  it.each(exposedTables)("habilita RLS em %s", (table) => expect(migration).toContain(`alter table public.${table} enable row level security;`));
  it("não concede execução anônima aos RPCs privilegiados", () => expect(migration).toMatch(/revoke all on function public\.create_quick_session[\s\S]+from public, anon;/));
  it("mantém service role fora de variáveis públicas", () => expect(migration).not.toContain("NEXT_PUBLIC"));
});
