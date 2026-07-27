import { expect, test } from "@playwright/test";

test("landing usa jogos reais e preserva tema", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveTitle(/Listed — Decida o que jogar com seus amigos/);
  await expect(page.getByRole("heading", { name: /Sua biblioteca.*lista do grupo.*decisão/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Criar uma lista/i })).toBeVisible();
  for (const game of ["Overcooked! 2", "Terraria", "Counter-Strike 2"]) await expect(page.getByRole("button", { name: new RegExp(`Votar em ${game.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) })).toBeVisible();
  await page.getByLabel("Escolher tema").click();
  await page.getByRole("menuitem", { name: "Escuro vermelho" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark-red");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark-red");
});

test("troca e persiste idioma sem alterar a rota", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Escolher idioma").click();
  await page.getByRole("menuitem", { name: /English \(US\)/ }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await expect(page.getByRole("heading", { name: /Your libraries.*shared list.*decision/i })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await expect(page.getByRole("link", { name: /Create a list/i })).toBeVisible();
});

test("formulário de criação é responsivo", async ({ page }) => {
  await page.goto("/create");
  await expect(page.getByLabel("Nome da lista")).toBeVisible();
  await expect(page.getByRole("button", { name: /Criar lista/i })).toBeVisible();
});

test("layout mobile não cria rolagem horizontal e mantém foco visível", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: /Ir para o conteúdo principal|Skip to main content/ })).toBeFocused();
});

test("movimento reduzido desativa a entrada estrutural", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const duration = await page.locator(".listed-enter").first().evaluate((element) => getComputedStyle(element).animationDuration);
  expect(["0s", "0.00001s", "1e-05s"]).toContain(duration);
});
