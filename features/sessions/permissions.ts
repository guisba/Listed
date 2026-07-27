import type { MemberRole, SessionSettings } from "@/types/domain";

export function canManageSession(role: MemberRole) {
  return role === "owner" || role === "co_owner" || role === "moderator";
}

export function canDeleteSession(role: MemberRole) {
  return role === "owner";
}

export type SessionAction =
  | "view_admin"
  | "change_roles"
  | "transfer_ownership"
  | "kick_member"
  | "kick_coowner"
  | "ban_member"
  | "unban_member"
  | "change_settings"
  | "add_game"
  | "remove_game"
  | "start_decision"
  | "delete_session"
  | "lock_voting";

export function canPerformSessionAction(
  role: MemberRole | null,
  action: SessionAction,
  settings: SessionSettings,
) {
  if (!role) return false;
  if (role === "owner") return true;
  if (role === "co_owner" || role === "moderator") {
    if (action === "view_admin") return true;
    if (action === "kick_member") return settings.coowners_can_kick_members;
    if (action === "ban_member") return settings.coowners_can_ban_members;
    if (action === "remove_game") {
      return settings.game_remove_permission === "coowners"
        && settings.coowners_can_remove_games;
    }
    if (action === "add_game") {
      return !settings.games_locked
        && settings.game_add_permission !== "owner";
    }
    if (action === "start_decision") {
      return settings.decision_permission !== "owner";
    }
    if (action === "lock_voting") return settings.coowners_can_lock_voting;
    return false;
  }
  if (action === "add_game") {
    return !settings.games_locked
      && settings.game_add_permission === "everyone";
  }
  if (action === "start_decision") {
    return settings.decision_permission === "everyone";
  }
  return false;
}

export function isSessionExpired(expiresAt: string | null, now = new Date()) {
  return expiresAt ? new Date(expiresAt).getTime() <= now.getTime() : false;
}
