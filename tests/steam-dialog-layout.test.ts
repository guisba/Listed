import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dialog = readFileSync(join(process.cwd(), "components", "games", "add-game-dialog.tsx"), "utf8");
const picker = readFileSync(join(process.cwd(), "components", "games", "steam-game-picker.tsx"), "utf8");

describe("Steam catalog dialog layout", () => {
  it("usa popup amplo no desktop e tela completa no mobile", () => {
    expect(dialog).toContain("min(960px,calc(100vw-48px))");
    expect(dialog).toContain("min(80vh,760px)");
    expect(dialog).toContain("100dvh");
  });

  it("mantém resultados e prévia em colunas adaptáveis", () => {
    expect(picker).toContain("md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]");
    expect(picker).toContain("Voltar aos resultados");
    expect(picker).toContain("Carregar mais");
  });

  it("não contém catálogo popular fixo no runtime", () => {
    expect(picker).not.toMatch(/Counter-Strike 2|Terraria|Left 4 Dead 2|Stardew Valley/);
  });
});
