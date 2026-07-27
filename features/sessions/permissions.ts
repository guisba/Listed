import type { MemberRole } from "@/types/domain";

export function canManageSession(role: MemberRole) {
  return role === "owner" || role === "co_owner" || role === "moderator";
}

export function canDeleteSession(role: MemberRole) {
  return role === "owner";
}

export function isSessionExpired(expiresAt: string | null, now = new Date()) {
  return expiresAt ? new Date(expiresAt).getTime() <= now.getTime() : false;
}
