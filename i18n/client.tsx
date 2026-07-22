"use client";

import { createContext, useCallback, useContext, useMemo, type PropsWithChildren } from "react";
import { interpolate, type Locale } from "./config";
import type { MessageKey, Messages } from "./dictionaries";

interface I18nContextValue {
  locale: Locale;
  messages: Messages;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
  plural: (one: MessageKey, other: MessageKey, count: number) => string;
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ locale, messages, children }: PropsWithChildren<{ locale: Locale; messages: Messages }>) {
  const t = useCallback((key: MessageKey, values?: Record<string, string | number>) => interpolate(messages[key], values), [messages]);
  const value = useMemo<I18nContextValue>(() => ({
    locale,
    messages,
    t,
    plural: (one, other, count) => t(new Intl.PluralRules(locale).select(count) === "one" ? one : other, { count }),
    formatDate: (input, options) => new Intl.DateTimeFormat(locale, options).format(new Date(input)),
    formatNumber: (input, options) => new Intl.NumberFormat(locale, options).format(input),
  }), [locale, messages, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("I18nProvider is missing");
  return value;
}
