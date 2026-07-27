import { describe, expect, it } from "vitest";
import { normalizeSteamFeatures } from "@/lib/steam/features";

describe("normalizeSteamFeatures", () => {
  it("normaliza categorias estruturadas", () => {
    expect(normalizeSteamFeatures([{ description: "Online Co-op" }, { description: "Full controller support" }], { windows: true, mac: false, linux: true }, true)).toEqual(expect.arrayContaining(["coop-online", "controller-support", "free-to-play", "windows", "linux"]));
  });

  it("usa IDs estáveis mesmo quando a descrição está localizada", () => {
    expect(normalizeSteamFeatures([
      { id: 2, description: "Um jogador" },
      { id: 38, description: "Cooperativo on-line" },
      { id: 28, description: "Compat. total com controle" },
    ], { windows: true }, false)).toEqual(expect.arrayContaining([
      "singleplayer",
      "coop-online",
      "controller-support",
      "windows",
    ]));
  });
});
