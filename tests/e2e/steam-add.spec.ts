import { expect, test } from "@playwright/test";

test("abre uma sessão e inclui Terraria pelo seletor Steam mockado", async ({ page }) => {
  await page.route("**/api/steam/search?**", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q");
    const payload = query === "105600"
      ? {
          kind: "preview",
          games: [{
            id: "catalog-terraria", appid: 105600, name: "Terraria", type: "game",
            storeUrl: "https://store.steampowered.com/app/105600/", headerImage: null, coverImage: null,
            shortDescription: "Dig, fight, explore.", fullDescription: null, releaseDate: "16 May, 2011", comingSoon: false,
            platforms: ["windows"], genres: ["Ação"], categories: ["Online Co-op"], features: ["coop-online"],
            developers: ["Re-Logic"], publishers: ["Re-Logic"], supportedLanguages: ["Português"],
            price: null, isFree: false, metadataStatus: "complete", cacheState: "fresh",
          }],
        }
      : { kind: "matches", games: [{ appid: 105600, name: "Terraria", type: "game", id: null, headerImage: null }] };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });
  let confirmed = false;
  await page.route("**/api/steam/session-game", async (route) => {
    confirmed = true;
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await page.goto("/create");
  await page.getByLabel("Nome da lista").fill(`Steam E2E ${Date.now()}`);
  await page.getByLabel("Como devemos chamar você?").fill("Playwright");
  await page.getByRole("button", { name: /Criar lista/i }).click();
  await expect(page).toHaveURL(/\/s\/[A-Z0-9]+/, { timeout: 20_000 });
  await page.getByRole("button", { name: /Adicionar jogo/i }).click();
  const input = page.getByRole("combobox", { name: "Buscar jogo na Steam" });
  await input.fill("Terraria");
  await page.getByRole("option", { name: /Terraria/ }).click();
  await expect(page.getByRole("heading", { name: "Terraria" })).toBeVisible();
  await page.getByRole("button", { name: /Confirmar inclusão/ }).click();
  await expect.poll(() => confirmed).toBe(true);
  await expect(page.getByRole("dialog")).toBeHidden();
});
