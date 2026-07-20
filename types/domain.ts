export type ThemeName = "light" | "dark" | "dark-red";
export type DecisionMethod =
  | "multi_vote"
  | "single_vote"
  | "random"
  | "weighted_random"
  | "ranking"
  | "elimination"
  | "tournament"
  | "veto";
export type MemberRole = "owner" | "moderator" | "member";
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
}

export interface SessionMember {
  id: string;
  user_id: string;
  display_name: string;
  role: MemberRole;
  joined_at: string;
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
  has_voted?: boolean;
  ownership_status?: OwnershipStatus;
}
