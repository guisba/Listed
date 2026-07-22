import { LegalPage } from "@/components/legal/legal-page";
import { getServerI18n } from "@/i18n/server";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> { const { t } = await getServerI18n(); return { title: t("privacy.meta") }; }

export default async function PrivacyPage() {
  const { t } = await getServerI18n();
  return <LegalPage title={t("privacy.title")} intro={t("privacy.intro")}><section><h2 className="text-xl font-bold text-foreground">{t("privacy.data.title")}</h2><p className="mt-2">{t("privacy.data.text")}</p></section><section><h2 className="text-xl font-bold text-foreground">{t("privacy.temporary.title")}</h2><p className="mt-2">{t("privacy.temporary.text")}</p></section><section><h2 className="text-xl font-bold text-foreground">{t("privacy.services.title")}</h2><p className="mt-2">{t("privacy.services.text")}</p></section></LegalPage>;
}
