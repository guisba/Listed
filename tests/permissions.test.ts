import { describe, expect, it } from "vitest";
import { canDeleteSession, canManageSession, canPerformSessionAction, isSessionExpired } from "@/features/sessions/permissions";
import type { SessionSettings } from "@/types/domain";

const settings: SessionSettings = {
  session_id: "00000000-0000-4000-8000-000000000001",
  games_locked: false,
  voting_locked: false,
  members_can_add_games: true,
  coowners_can_manage_games: true,
  coowners_can_manage_members: false,
  coowners_can_manage_settings: false,
  game_add_permission: "everyone",
  game_remove_permission: "coowners",
  allow_vote_changes: true,
  max_votes_per_member: 0,
  decision_permission: "everyone",
  allow_anonymous_members: true,
  coowners_can_kick_members: false,
  coowners_can_ban_members: false,
  coowners_can_remove_games: true,
  coowners_can_lock_voting: false,
  updated_at: "2026-07-27T00:00:00Z",
};

describe("session permissions", () => {
  it("limita administração a owner e co-owner, preservando moderador legado", () => { expect(canManageSession("owner")).toBe(true); expect(canManageSession("co_owner")).toBe(true); expect(canManageSession("moderator")).toBe(true); expect(canManageSession("member")).toBe(false); });
  it("limita exclusão ao owner", () => { expect(canDeleteSession("owner")).toBe(true); expect(canDeleteSession("co_owner")).toBe(false); });
  it("aplica a matriz de permissões ao owner, co-owner, member e externo", () => {
    expect(canPerformSessionAction("owner", "change_roles", settings)).toBe(true);
    expect(canPerformSessionAction("owner", "transfer_ownership", settings)).toBe(true);
    expect(canPerformSessionAction("co_owner", "change_roles", settings)).toBe(false);
    expect(canPerformSessionAction("co_owner", "kick_member", settings)).toBe(false);
    expect(canPerformSessionAction("member", "view_admin", settings)).toBe(false);
    expect(canPerformSessionAction(null, "add_game", settings)).toBe(false);
  });
  it("delega apenas capacidades explicitamente habilitadas", () => {
    const delegated = {
      ...settings,
      coowners_can_kick_members: true,
      coowners_can_ban_members: true,
      coowners_can_lock_voting: true,
    };
    expect(canPerformSessionAction("co_owner", "kick_member", delegated)).toBe(true);
    expect(canPerformSessionAction("co_owner", "ban_member", delegated)).toBe(true);
    expect(canPerformSessionAction("co_owner", "lock_voting", delegated)).toBe(true);
    expect(canPerformSessionAction("co_owner", "kick_coowner", delegated)).toBe(false);
    expect(canPerformSessionAction("co_owner", "change_settings", delegated)).toBe(false);
  });
  it("honra escopos de jogos e decisão", () => {
    const ownerOnly = {
      ...settings,
      game_add_permission: "owner" as const,
      game_remove_permission: "owner" as const,
      decision_permission: "owner" as const,
    };
    expect(canPerformSessionAction("member", "add_game", ownerOnly)).toBe(false);
    expect(canPerformSessionAction("co_owner", "remove_game", ownerOnly)).toBe(false);
    expect(canPerformSessionAction("member", "start_decision", ownerOnly)).toBe(false);
  });
  it("calcula expiração", () => expect(isSessionExpired("2025-01-01T00:00:00Z", new Date("2026-01-01T00:00:00Z"))).toBe(true));
});
