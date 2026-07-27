import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("semantic themes", () => {
  const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");
  const provider = readFileSync(join(process.cwd(), "components", "theme", "theme-provider.tsx"), "utf8");

  it.each(["light", "dark", "dark-red", "purple", "oled-black"])("defines complete semantic tokens for %s", (theme) => {
    const block = css.match(new RegExp(`\\[data-theme="${theme}"\\] \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? "";
    for (const token of ["--background", "--foreground", "--card", "--primary", "--accent", "--border", "--ring", "--success", "--warning"]) {
      expect(block).toContain(token);
    }
    expect(provider).toContain(`"${theme}"`);
  });

  it("keeps OLED background truly black", () => {
    expect(css).toMatch(/\[data-theme="oled-black"\][\s\S]*?--background: #000000;/);
  });
});
