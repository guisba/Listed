import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { getServerI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> { const { t } = await getServerI18n(); return { title: t("settings.meta") }; }

export default async function SettingsPage() {
  const { t } = await getServerI18n();
  return <div className="min-h-screen"><SiteHeader /><main id="main-content" className="mx-auto max-w-3xl px-4 py-12 sm:px-6"><p className="listed-eyebrow">{t("settings.eyebrow")}</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.04em]">{t("settings.title")}</h1><section className="mt-9 grid gap-5 border-y border-border py-6 sm:grid-cols-[1fr_auto] sm:items-center"><div><h2 className="font-semibold">{t("settings.appearance")}</h2><p className="mt-1 max-w-lg text-sm leading-6 text-muted-foreground">{t("settings.appearanceDescription")}</p></div><ThemeSwitcher /></section><section className="grid gap-5 border-b border-border py-6 sm:grid-cols-[1fr_auto] sm:items-center"><div><h2 className="font-semibold">{t("settings.language")}</h2><p className="mt-1 max-w-lg text-sm leading-6 text-muted-foreground">{t("settings.languageDescription")}</p></div><LocaleSwitcher /></section><section className="py-6"><h2 className="font-semibold">{t("settings.motion")}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{t("settings.motionDescription")}</p></section></main></div>;
}
