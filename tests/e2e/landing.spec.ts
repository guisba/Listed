import { expect, test } from "@playwright/test";

test("landing orienta criação e entrada", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Menos debate/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Criar uma sessão/i })).toBeVisible();
  await page.getByLabel("Escolher tema").click();
  await page.getByText("Escuro vermelho", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark-red");
});

test("formulário de criação é responsivo", async ({ page }) => {
  await page.goto("/create");
  await expect(page.getByLabel("Nome da sessão")).toBeVisible();
  await expect(page.getByRole("button", { name: /Criar sessão/i })).toBeVisible();
});
