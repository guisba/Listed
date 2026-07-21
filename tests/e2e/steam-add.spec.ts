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
      : { kind: "matches", catalog: { status: "complete", indexedGames: 100000, lastSyncAt: null }, pagination: { hasMore: false }, games: [{ appid: 105600, name: "Terraria", type: "game", id: null, headerImage: null, releaseDate: "2011", platforms: ["windows"], relevance: 1 }] };
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
  await page.getByRole("button", { name: /Adicionar à lista/ }).click();
  await expect.poll(() => confirmed).toBe(true);
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("popup Steam amplo adapta resultados e prévia em seis larguras e três temas", async ({ page }) => {
  await page.route("**/api/steam/search?**", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q");
    const payload = query === "526870"
      ? {
          kind: "preview",
          catalog: { status: "partial", indexedGames: 25000, lastSyncAt: null },
          games: [{
            id: "catalog-outside-seed", appid: 526870, name: "Satisfactory", type: "game",
            storeUrl: "https://store.steampowered.com/app/526870/", headerImage: null, coverImage: null,
            shortDescription: "Construa fábricas em um planeta alienígena.", fullDescription: "Descrição completa para validar o painel amplo.", releaseDate: "10 Sep, 2024", comingSoon: false,
            platforms: ["windows"], genres: ["Aventura", "Estratégia"], categories: ["Online Co-op", "Single-player"], features: ["coop-online", "singleplayer", "controller-support"],
            developers: ["Coffee Stain Studios"], publishers: ["Coffee Stain Publishing"], supportedLanguages: ["Português"],
            price: null, isFree: false, metadataStatus: "complete", cacheState: "fresh",
          }],
        }
      : {
          kind: "matches",
          catalog: { status: "partial", indexedGames: 25000, lastSyncAt: null },
          pagination: { limit: 12, offset: 0, total: 1, hasMore: false },
          games: [{ appid: 526870, name: "Satisfactory", type: "game", id: null, headerImage: null, releaseDate: "2024", platforms: ["windows"], relevance: 0.9 }],
        };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });

  await page.goto("/create");
  await page.getByLabel("Nome da lista").fill(`Steam layout ${Date.now()}`);
  await page.getByLabel("Como devemos chamar você?").fill("Layout E2E");
  await page.getByRole("button", { name: /Criar lista/i }).click();
  await expect(page).toHaveURL(/\/s\/[A-Z0-9]+/, { timeout: 20_000 });

  for (const theme of ["Claro", "Escuro", "Escuro vermelho"]) {
    await page.getByLabel("Escolher tema").click();
    await page.getByRole("menuitem", { name: theme, exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme === "Claro" ? "light" : theme === "Escuro" ? "dark" : "dark-red");
  }

  const viewports = [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 768, height: 800 },
    { width: 430, height: 820 },
    { width: 375, height: 760 },
    { width: 320, height: 700 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.getByRole("button", { name: /Adicionar jogo/i }).click();
    const dialog = page.getByRole("dialog", { name: "Adicionar à lista" });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    if (viewport.width < 640) {
      expect(box!.width).toBeGreaterThanOrEqual(viewport.width - 2);
      expect(box!.height).toBeGreaterThanOrEqual(viewport.height - 2);
    } else {
      expect(box!.width).toBeGreaterThanOrEqual(Math.min(850, viewport.width - 56));
      expect(box!.width).toBeLessThanOrEqual(962);
      expect(box!.height).toBeLessThanOrEqual(762);
    }

    const input = page.getByRole("combobox", { name: "Buscar jogo na Steam" });
    await input.fill("satisf");
    await page.getByRole("option", { name: /Satisfactory/ }).click();
    await expect(page.getByRole("heading", { name: "Satisfactory" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Adicionar à lista" })).toBeVisible();
    if (viewport.width < 768) await expect(page.getByRole("button", { name: "Voltar aos resultados" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  }
});
