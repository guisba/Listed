import { expect, test } from "@playwright/test";

async function createSession(page: import("@playwright/test").Page, suffix: string) {
  await page.goto("/create");
  await page.getByLabel("Nome da lista").fill(`Controles E2E ${suffix}`);
  await page.getByLabel("Como devemos chamar você?").fill(`Owner ${suffix}`);
  await page.getByRole("button", { name: /Criar lista/i }).click();
  await expect(page).toHaveURL(/\/s\/[A-Z0-9]+/, { timeout: 20_000 });
  return new URL(page.url()).pathname.split("/").at(-1)!;
}

async function joinSession(page: import("@playwright/test").Page, code: string, name: string) {
  await page.goto(`/join?code=${code}`);
  await page.getByLabel("Seu nome").fill(name);
  await page.getByRole("button", { name: /^Entrar na lista$/i }).click();
  await expect(page).toHaveURL(new RegExp(`/s/${code}`), { timeout: 20_000 });
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
}

test("filtros, compartilhamento e cinco temas preservam estado no desktop e mobile", async ({ page }) => {
  const suffix = `${Date.now()}`.slice(-7);
  const code = await createSession(page, suffix);

  const themes = [
    ["Claro", "light"],
    ["Escuro", "dark"],
    ["Escuro vermelho", "dark-red"],
    ["Roxo", "purple"],
    ["Preto OLED", "oled-black"],
  ] as const;
  for (const [label, value] of themes) {
    await page.getByLabel("Escolher tema").click();
    await page.getByRole("menuitem", { name: label, exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", value);
  }
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "oled-black");

  await page.getByRole("button", { name: /^Filtros$/ }).click();
  const filters = page.getByRole("dialog", { name: "Filtrar jogos" });
  await expect(filters).toBeVisible();
  await filters.getByRole("button", { name: "Cooperativo online" }).click();
  await filters.getByRole("button", { name: "Windows" }).click();
  await expect(filters.getByText(/2 filtros ativos/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/filters=/);

  await page.getByRole("button", { name: "Compartilhar lista" }).click();
  const share = page.getByRole("dialog", { name: "Passe de entrada" });
  await expect(share).toBeVisible();
  await expect(share.getByLabel("QR code da lista")).toBeVisible();
  expect(await share.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  const shareBox = await share.boundingBox();
  const qrBox = await share.getByLabel("QR code da lista").boundingBox();
  expect(shareBox && qrBox && qrBox.x + qrBox.width <= shareBox.x + shareBox.width).toBe(true);
  await expect(share.getByRole("button", { name: code })).toBeVisible();
  await expect(share.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\//);
  await expect(share.getByRole("link", { name: "Telegram" })).toHaveAttribute("href", /^https:\/\/t\.me\//);
  await expect(share.getByRole("link", { name: "E-mail" })).toHaveAttribute("href", /^mailto:/);
});

test("owner, co-owner e member recebem poderes e remoção em tempo real", async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  test.skip(testInfo.project.name !== "chromium", "A matriz multi-identidade roda uma vez no projeto desktop.");
  const baseURL = testInfo.project.use.baseURL as string;
  const storageState = testInfo.project.use.storageState as string | undefined;
  const suffix = `${Date.now()}`.slice(-7);
  const ownerContext = await browser.newContext({ baseURL, locale: "pt-BR", storageState });
  const coOwnerContext = await browser.newContext({ baseURL, locale: "pt-BR", storageState });
  const memberContext = await browser.newContext({ baseURL, locale: "pt-BR", storageState });
  const owner = await ownerContext.newPage();
  const coOwner = await coOwnerContext.newPage();
  const member = await memberContext.newPage();
  const coOwnerName = `Co ${suffix}`;
  const memberName = `Member ${suffix}`;

  try {
    const code = await createSession(owner, suffix);
    await joinSession(coOwner, code, coOwnerName);
    await joinSession(member, code, memberName);
    await owner.reload();
    await expect(owner.getByText(coOwnerName, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    await expect(owner.getByText(memberName, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    await expect(member.getByRole("button", { name: "Abrir administração" })).toHaveCount(0);

    await owner.getByRole("button", { name: "Abrir administração" }).click();
    let admin = owner.getByRole("dialog", { name: "Comando da lista" });
    const coOwnerRow = admin.locator("article").filter({ hasText: coOwnerName });
    await coOwnerRow.getByRole("button", { name: "Tornar co-dono" }).click();
    await owner.getByRole("dialog", { name: "Confirmar ação" }).getByRole("button", { name: "Confirmar" }).click();
    await expect(owner.getByText("Ação concluída")).toBeVisible();

    await admin.getByRole("tab", { name: "Permissões" }).click();
    await admin.getByLabel("Co-donos removem membros").check({ force: true });
    await admin.getByLabel("Co-donos alteram configurações").check({ force: true });
    await admin.getByRole("button", { name: "Salvar configurações" }).click();
    await expect(owner.getByText("Configurações salvas")).toBeVisible();
    await owner.keyboard.press("Escape");

    await expect(coOwner.getByRole("button", { name: "Abrir administração" })).toBeVisible({ timeout: 20_000 });
    await coOwner.reload();
    await coOwner.getByRole("button", { name: "Abrir administração" }).click();
    const coAdmin = coOwner.getByRole("dialog", { name: "Comando da lista" });
    await expect(coAdmin.getByRole("button", { name: "Transferir propriedade" })).toHaveCount(0);
    await coAdmin.getByRole("tab", { name: "Permissões" }).click();
    await coAdmin.getByLabel("Bloquear votação").check({ force: true });
    await coAdmin.getByRole("button", { name: "Salvar configurações" }).click();
    await expect(coOwner.getByText("Configurações salvas")).toBeVisible();
    await coAdmin.getByRole("tab", { name: "Participantes" }).click();
    const memberRow = coAdmin.locator("article").filter({ hasText: memberName });
    await memberRow.getByRole("button", { name: "Remover", exact: true }).click();
    const removeResponsePromise = coOwner.waitForResponse((response) => response.url().includes("/rpc/remove_session_member"));
    await coOwner.getByRole("dialog", { name: "Confirmar ação" }).getByRole("button", { name: "Confirmar" }).click();
    const removeResponse = await removeResponsePromise;
    expect(removeResponse.status(), await removeResponse.text()).toBe(204);
    await expect(member).toHaveURL(/\/\?sessionAccess=removed/, { timeout: 25_000 });

    await owner.getByRole("button", { name: "Abrir administração" }).click();
    admin = owner.getByRole("dialog", { name: "Comando da lista" });
    const promotedRow = admin.locator("article").filter({ hasText: coOwnerName });
    await promotedRow.getByRole("button", { name: "Tornar membro" }).click();
    await owner.getByRole("dialog", { name: "Confirmar ação" }).getByRole("button", { name: "Confirmar" }).click();
    await expect(owner.getByText("Ação concluída")).toBeVisible();
    await admin.locator("article").filter({ hasText: coOwnerName }).getByRole("button", { name: "Transferir propriedade" }).click();
    const transferResponsePromise = owner.waitForResponse((response) => response.url().includes("/rpc/transfer_session_ownership"));
    await owner.getByRole("dialog", { name: "Confirmar ação" }).getByRole("button", { name: "Confirmar" }).click();
    const transferResponse = await transferResponsePromise;
    expect(transferResponse.status(), await transferResponse.text()).toBe(204);

    await expect(coOwner.getByText(coOwnerName, { exact: true }).locator("..").getByText("dono", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(admin.getByRole("button", { name: "Transferir propriedade" })).toHaveCount(0);
  } finally {
    await Promise.all([ownerContext.close(), coOwnerContext.close(), memberContext.close()]);
  }
});
