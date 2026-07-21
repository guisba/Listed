import { expect, test } from "@playwright/test";

test("landing orienta criação e entrada", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveTitle(/Listed — Decida o que jogar/);
  await expect(page.getByRole("heading", { name: /Liste.*Vote.*Jogue/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Criar uma lista/i })).toBeVisible();
  await page.getByLabel("Escolher tema").click();
  await page.getByRole("menuitem", { name: "Escuro vermelho" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark-red");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark-red");
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
  await expect(page.getByRole("link", { name: "Listed — início" })).toBeFocused();
});

test("movimento reduzido desativa a entrada estrutural", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const duration = await page.locator(".listed-enter").first().evaluate((element) => getComputedStyle(element).animationDuration);
  expect(["0s", "0.00001s", "1e-05s"]).toContain(duration);
});
