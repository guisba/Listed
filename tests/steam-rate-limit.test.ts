import { describe, expect, it } from "vitest";
import { consumeSteamRateLimit } from "@/lib/steam/rate-limit";

describe("Steam rate limit", () => {
  it("bloqueia acima do limite por identidade", () => {
    const key = `user-${crypto.randomUUID()}`;
    expect(consumeSteamRateLimit(key, 2, 60_000).allowed).toBe(true);
    expect(consumeSteamRateLimit(key, 2, 60_000).allowed).toBe(true);
    expect(consumeSteamRateLimit(key, 2, 60_000)).toMatchObject({ allowed: false });
  });
});
