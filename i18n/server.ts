import "server-only";

import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, interpolate, isLocale, localeFromAcceptLanguage, LOCALE_COOKIE, type Locale } from "./config";
import { loadDictionary, type MessageKey, type Messages } from "./dictionaries";

export async function getLocale(): Promise<Locale> {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;
  const acceptLanguage = (await headers()).get("accept-language");
  return acceptLanguage ? localeFromAcceptLanguage(acceptLanguage) : DEFAULT_LOCALE;
}

export async function getServerI18n() {
  const locale = await getLocale();
  const messages = await loadDictionary(locale);
  return {
    locale,
    messages,
    t: (key: MessageKey, values?: Record<string, string | number>) => interpolate(messages[key], values),
  };
}

export function translate(messages: Messages, key: MessageKey, values?: Record<string, string | number>) {
  return interpolate(messages[key], values);
}
