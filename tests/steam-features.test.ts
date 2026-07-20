import { describe, expect, it } from "vitest";
import { normalizeSteamFeatures } from "@/lib/steam/features";

describe("normalizeSteamFeatures", () => {
  it("normaliza categorias estruturadas", () => {
    expect(normalizeSteamFeatures(["Online Co-op", "Full controller support"], { windows: true, mac: false, linux: true }, true)).toEqual(expect.arrayContaining(["coop-online", "controller-support", "free-to-play", "windows", "linux"]));
  });
});
