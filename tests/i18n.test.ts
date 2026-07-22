import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, interpolate, isLocale, localeFromAcceptLanguage } from "@/i18n/config";
import { loadDictionary } from "@/i18n/dictionaries";
import ptBR from "@/i18n/dictionaries/pt-BR";
import enUS from "@/i18n/dictionaries/en-US";

describe("i18n", () => {
  it("mantém os dois dicionários completos e sem chaves renderizadas", async () => {
    expect(Object.keys(enUS).sort()).toEqual(Object.keys(ptBR).sort());
    expect(await loadDictionary("pt-BR")).toBe(ptBR);
    expect((await loadDictionary("en-US"))["landing.title"]).toBe("Your libraries. One shared list. One decision.");
    for (const messages of [ptBR, enUS]) {
      expect(Object.values(messages).every((message) => message.trim().length > 0)).toBe(true);
    }
  });

  it("valida e detecta locales com fallback seguro", () => {
    expect(isLocale("pt-BR")).toBe(true);
    expect(isLocale("en-US")).toBe(true);
    expect(isLocale("fr-FR")).toBe(false);
    expect(localeFromAcceptLanguage("pt-PT,pt;q=0.9,en;q=0.8")).toBe("pt-BR");
    expect(localeFromAcceptLanguage("en-GB,en;q=0.9")).toBe("en-US");
    expect(localeFromAcceptLanguage(null)).toBe(DEFAULT_LOCALE);
  });

  it("interpola, pluraliza e formata com Intl por idioma", () => {
    expect(interpolate(ptBR["common.games.other"], { count: 2 })).toBe("2 jogos");
    expect(new Intl.PluralRules("en-US").select(1)).toBe("one");
    expect(new Intl.NumberFormat("pt-BR").format(175_000)).toMatch(/175[\.\s]000/);
    expect(new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date("2026-07-21T00:00:00Z"))).toBe("July 21, 2026");
  });
});
