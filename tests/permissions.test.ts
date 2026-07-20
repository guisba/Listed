import { describe, expect, it } from "vitest";
import { canDeleteSession, canManageSession, isSessionExpired } from "@/features/sessions/permissions";

describe("session permissions", () => {
  it("limita administração a owner e moderador", () => { expect(canManageSession("owner")).toBe(true); expect(canManageSession("moderator")).toBe(true); expect(canManageSession("member")).toBe(false); });
  it("limita exclusão ao owner", () => { expect(canDeleteSession("owner")).toBe(true); expect(canDeleteSession("moderator")).toBe(false); });
  it("calcula expiração", () => expect(isSessionExpired("2025-01-01T00:00:00Z", new Date("2026-01-01T00:00:00Z"))).toBe(true));
});
