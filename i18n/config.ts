export const SUPPORTED_LOCALES = ["pt-BR", "en-US"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "pt-BR";
export const LOCALE_COOKIE = "listed_locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && SUPPORTED_LOCALES.includes(value as Locale);
}

export function localeFromAcceptLanguage(value: string | null | undefined): Locale {
  if (!value) return DEFAULT_LOCALE;
  return value
    .split(",")
    .map((item) => item.trim().split(";")[0]?.toLowerCase())
    .some((language) => language === "pt" || language?.startsWith("pt-"))
    ? "pt-BR"
    : "en-US";
}

export function interpolate(message: string, values?: Record<string, string | number>) {
  if (!values) return message;
  return message.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match,
  );
}
