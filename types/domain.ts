export type ThemeName = "light" | "dark" | "dark-red" | "purple" | "oled-black";
export type DecisionMethod =
  | "multi_vote"
  | "single_vote"
  | "random"
  | "weighted_random"
  | "ranking"
  | "elimination"
  | "tournament"
  | "veto";
export type MemberRole = "owner" | "co_owner" | "moderator" | "member";
export type SessionPermissionScope = "owner" | "coowners" | "everyone";
export type OwnershipStatus =
  | "owns"
  | "does_not_own"
  | "other_platform"
  | "unknown"
  | "subscription"
  | "free";

export interface SessionSummary {
  id: string;
  title: string;
  public_code: string;
  status: "open" | "locked" | "deciding" | "closed" | "expired";
  decision_method: DecisionMethod;
  expires_at: string | null;
  owner_id: string;
  max_participants: number;
}

export interface SessionMember {
  id: string;
  user_id: string;
  display_name: string;
  role: MemberRole;
  joined_at: string;
  vote_count?: number;
  owned_games_count?: number;
}

export interface SessionSettings {
  session_id: string;
  games_locked: boolean;
  voting_locked: boolean;
  members_can_add_games: boolean;
  coowners_can_manage_games: boolean;
  coowners_can_manage_members: boolean;
  coowners_can_manage_settings: boolean;
  game_add_permission: SessionPermissionScope;
  game_remove_permission: Exclude<SessionPermissionScope, "everyone">;
  allow_vote_changes: boolean;
  max_votes_per_member: number;
  decision_permission: SessionPermissionScope;
  allow_anonymous_members: boolean;
  coowners_can_kick_members: boolean;
  coowners_can_ban_members: boolean;
  coowners_can_remove_games: boolean;
  coowners_can_lock_voting: boolean;
  updated_at: string;
}

export interface SessionBan {
  id: string;
  session_id: string;
  user_id: string;
  banned_by: string;
  display_name: string;
  reason: string | null;
  created_at: string;
}

export interface SessionAuditLog {
  id: string;
  session_id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SessionGame {
  id: string;
  session_id: string;
  catalog_game_id: string | null;
  source: "manual" | "steam";
  name: string;
  normalized_name: string;
  image_url: string | null;
  store_url: string | null;
  platforms: string[];
  features: string[];
  min_players: number | null;
  max_players: number | null;
  added_by: string;
  created_at: string;
  vote_count?: number;
  owner_count?: number;
  member_count?: number;
  has_voted?: boolean;
  ownership_status?: OwnershipStatus;
}
