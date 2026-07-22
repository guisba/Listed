import { LegalPage } from "@/components/legal/legal-page";
import { getServerI18n } from "@/i18n/server";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> { const { t } = await getServerI18n(); return { title: t("terms.meta") }; }

export default async function TermsPage() {
  const { t } = await getServerI18n();
  return <LegalPage title={t("terms.title")} intro={t("terms.intro")}><section><h2 className="text-xl font-bold text-foreground">{t("terms.acceptable.title")}</h2><p className="mt-2">{t("terms.acceptable.text")}</p></section><section><h2 className="text-xl font-bold text-foreground">{t("terms.content.title")}</h2><p className="mt-2">{t("terms.content.text")}</p></section><section><h2 className="text-xl font-bold text-foreground">{t("terms.availability.title")}</h2><p className="mt-2">{t("terms.availability.text")}</p></section></LegalPage>;
}
