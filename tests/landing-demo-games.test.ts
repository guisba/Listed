import { describe, expect, it } from "vitest";
import { buildLandingDemoGames, LANDING_DEMO_APP_IDS } from "@/lib/landing/demo-games";

describe("landing demo games", () => {
  it("usa somente os três AppIDs reais escolhidos", () => {
    expect(LANDING_DEMO_APP_IDS).toEqual([728880, 105600, 730]);
    const games = buildLandingDemoGames(
      LANDING_DEMO_APP_IDS.map((appid) => ({ appid, name: appid === 728880 ? "Overcooked! 2" : appid === 105600 ? "Terraria" : "Counter-Strike 2" })),
      [{ steam_appid: 105600, name: "Terraria", cover_image: "https://shared.akamai.steamstatic.com/terraria.jpg", release_date: "16 May, 2011", platforms: ["windows"], genres: ["Action"], categories: ["Co-op"], features: ["coop-online"] }],
    );
    expect(games.map(({ appid, name }) => ({ appid, name }))).toEqual([
      { appid: 728880, name: "Overcooked! 2" }, { appid: 105600, name: "Terraria" }, { appid: 730, name: "Counter-Strike 2" },
    ]);
    expect(games[1]).toMatchObject({ capsuleImageUrl: "https://shared.akamai.steamstatic.com/terraria.jpg", releaseYear: "2011", metadataAvailable: true });
  });

  it("degrada para nome oficial, AppID e placeholder sem inventar metadados", () => {
    const games = buildLandingDemoGames([], []);
    expect(games.map((game) => game.name)).toEqual(["Overcooked! 2", "Terraria", "Counter-Strike 2"]);
    expect(games.every((game) => game.capsuleImageUrl === null && game.metadataAvailable === false && game.genresCount === 0)).toBe(true);
  });
});
