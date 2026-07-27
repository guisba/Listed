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

test("owner, co-owner e member cumprem promoção, permissões, kick, ban, unban e transferência", async ({ browser }, testInfo) => {
  test.setTimeout(210_000);
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
  const capture = async (page: import("@playwright/test").Page, name: string) => {
    if (process.env.CAPTURE_ADMIN_EVIDENCE === "1") {
      await page.screenshot({ path: `docs/screenshots/admin-final/${name}.png`, fullPage: true });
    }
  };

  try {
    const code = await createSession(owner, suffix);
    await joinSession(coOwner, code, coOwnerName);
    await joinSession(member, code, memberName);
    await owner.reload();
    await expect(owner.getByText(coOwnerName, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    await expect(owner.getByText(memberName, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    await expect(owner.getByText("Owner", { exact: true }).first()).toBeVisible();
    await expect(member.getByRole("button", { name: "Gerenciar sessão" })).toHaveCount(0);

    await owner.getByRole("button", { name: "Gerenciar sessão" }).click();
    let admin = owner.getByRole("dialog", { name: "Gerenciar sessão" });
    await capture(owner, "01-members-panel");
    const coOwnerRow = admin.locator("article").filter({ hasText: coOwnerName });
    await coOwnerRow.getByRole("button", { name: `Ações para ${coOwnerName}` }).click();
    await admin.getByRole("button", { name: "Tornar co-dono" }).click();
    await capture(owner, "02-promote-confirmation");
    await owner.getByRole("dialog", { name: "Confirmar ação" }).getByRole("button", { name: "Confirmar" }).click();
    await expect(owner.getByText("Ação concluída")).toBeVisible();
    await expect(coOwner.getByText("Co-owner", { exact: true }).first()).toBeVisible({ timeout: 20_000 });

    const promotedRow = admin.locator("article").filter({ hasText: coOwnerName });
    await promotedRow.getByRole("button", { name: `Ações para ${coOwnerName}` }).click();
    await admin.getByRole("button", { name: "Tornar membro" }).click();
    await owner.getByRole("dialog", { name: "Confirmar ação" }).getByRole("button", { name: "Confirmar" }).click();
    await expect(coOwner.getByRole("button", { name: "Gerenciar sessão" })).toHaveCount(0, { timeout: 20_000 });
    await promotedRow.getByRole("button", { name: `Ações para ${coOwnerName}` }).click();
    await admin.getByRole("button", { name: "Tornar co-dono" }).click();
    await owner.getByRole("dialog", { name: "Confirmar ação" }).getByRole("button", { name: "Confirmar" }).click();
    await expect(coOwner.getByRole("button", { name: "Gerenciar sessão" })).toBeVisible({ timeout: 20_000 });

    await admin.getByRole("tab", { name: "Permissões" }).click();
    await admin.getByLabel("Quem pode adicionar jogos?").selectOption("owner");
    await admin.getByLabel("Co-owner pode expulsar membros").check({ force: true });
    await admin.getByLabel("Co-owner pode banir membros").check({ force: true });
    await admin.getByLabel("Co-owner pode bloquear votação").check({ force: true });
    await admin.getByLabel("Máximo de votos por membro").fill("2");
    await capture(owner, "03-permission-settings");
    await admin.getByRole("button", { name: "Salvar configurações" }).click();
    await expect(owner.getByText("Configurações salvas")).toBeVisible();
    await owner.keyboard.press("Escape");

    await expect(member.getByRole("button", { name: "Adicionar jogo" })).toBeDisabled({ timeout: 20_000 });
    const sessionResponsePromise = owner.waitForResponse((response) =>
      response.url().includes("/rest/v1/sessions?") && response.request().method() === "GET",
    );
    await owner.reload();
    const sessionResponse = await sessionResponsePromise;
    const sessionRows = await sessionResponse.json() as Array<{ id: string }>;
    const sessionId = sessionRows[0]?.id;
    expect(sessionId).toBeTruthy();
    const bypassStatus = await member.evaluate(async ({ targetSessionId }) => {
      const response = await fetch("/api/steam/session-game", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: targetSessionId, appid: 730 }),
      });
      return response.status;
    }, { targetSessionId: sessionId });
    expect(bypassStatus).toBe(403);

    await owner.getByRole("button", { name: "Gerenciar sessão" }).click();
    admin = owner.getByRole("dialog", { name: "Gerenciar sessão" });
    await admin.getByRole("tab", { name: "Permissões" }).click();
    await admin.getByLabel("Quem pode adicionar jogos?").selectOption("everyone");
    await admin.getByRole("button", { name: "Salvar configurações" }).click();
    await expect(member.getByRole("button", { name: "Adicionar jogo" })).toBeEnabled({ timeout: 20_000 });

    await member.getByRole("button", { name: "Adicionar jogo" }).click();
    const addDialog = member.getByRole("dialog", { name: "Adicionar à lista" });
    await addDialog.getByRole("tab", { name: "Manual" }).click();
    await addDialog.getByLabel("Nome *").fill(`Jogo admin ${suffix}`);
    await addDialog.getByRole("button", { name: "Adicionar manualmente" }).click();
    await expect(member.getByText(`Jogo admin ${suffix}`, { exact: true })).toBeVisible({ timeout: 20_000 });

    await coOwner.getByRole("button", { name: "Gerenciar sessão" }).click();
    const coAdmin = coOwner.getByRole("dialog", { name: "Gerenciar sessão" });
    await expect(coAdmin.getByRole("button", { name: "Transferir propriedade" })).toHaveCount(0);
    await expect(coAdmin.getByLabel("Quem pode adicionar jogos?")).toBeDisabled();
    await capture(coOwner, "04-coowner-active");
    await coAdmin.getByRole("tab", { name: "Membros" }).click();
    const memberRow = coAdmin.locator("article").filter({ hasText: memberName });
    await memberRow.getByRole("button", { name: `Ações para ${memberName}` }).click();
    await coAdmin.getByRole("button", { name: "Remover", exact: true }).click();
    await capture(coOwner, "05-kick-confirmation");
    const removeResponsePromise = coOwner.waitForResponse((response) => response.url().includes("/rpc/remove_session_member"));
    await coOwner.getByRole("dialog", { name: "Confirmar ação" }).getByRole("button", { name: "Confirmar" }).click();
    const removeResponse = await removeResponsePromise;
    expect(removeResponse.status(), await removeResponse.text()).toBe(204);
    await expect(member).toHaveURL(/\/\?sessionAccess=removed/, { timeout: 25_000 });
    await expect(member.getByText("Você foi removido desta sessão pelo administrador.")).toBeVisible();
    await capture(member, "06-kicked-member");

    await joinSession(member, code, memberName);

    await owner.getByRole("button", { name: "Gerenciar sessão" }).click();
    admin = owner.getByRole("dialog", { name: "Gerenciar sessão" });
    const returnedMember = admin.locator("article").filter({ hasText: memberName });
    await returnedMember.getByRole("button", { name: `Ações para ${memberName}` }).click();
    await admin.getByRole("button", { name: "Remover e bloquear" }).click();
    await owner.getByRole("dialog", { name: "Confirmar ação" }).getByLabel("Motivo (opcional)").fill("Evidência E2E");
    await owner.getByRole("dialog", { name: "Confirmar ação" }).getByRole("button", { name: "Confirmar" }).click();
    await expect(member).toHaveURL(/\/\?sessionAccess=banned/, { timeout: 25_000 });

    await member.goto(`/join?code=${code}`);
    await member.getByLabel("Seu nome").fill(memberName);
    await member.getByRole("button", { name: /^Entrar na lista$/i }).click();
    await expect(member.getByText("Você não tem permissão para entrar nesta sessão.")).toBeVisible();

    await admin.getByRole("tab", { name: "Membros" }).click();
    await expect(admin.getByText(memberName, { exact: true })).toBeVisible({ timeout: 20_000 });
    await capture(owner, "07-banned-members");
    await admin.getByRole("button", { name: "Desbloquear" }).click();
    await owner.getByRole("dialog", { name: "Confirmar ação" }).getByRole("button", { name: "Confirmar" }).click();
    await joinSession(member, code, memberName);

    const ownerTargetRow = admin.locator("article").filter({ hasText: coOwnerName });
    await ownerTargetRow.getByRole("button", { name: `Ações para ${coOwnerName}` }).click();
    await admin.getByRole("button", { name: "Transferir propriedade" }).click();
    await capture(owner, "08-transfer-confirmation");
    const transferResponsePromise = owner.waitForResponse((response) => response.url().includes("/rpc/transfer_session_ownership"));
    await owner.getByRole("dialog", { name: "Confirmar ação" }).getByRole("button", { name: "Confirmar" }).click();
    const transferResponse = await transferResponsePromise;
    expect(transferResponse.status(), await transferResponse.text()).toBe(204);

    await expect(coOwner.getByText(coOwnerName, { exact: true }).locator("..").getByText("Owner", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(owner.getByText("Co-owner", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    await expect(admin.getByRole("button", { name: "Transferir propriedade" })).toHaveCount(0);
  } finally {
    await Promise.all([ownerContext.close(), coOwnerContext.close(), memberContext.close()]);
  }
});
