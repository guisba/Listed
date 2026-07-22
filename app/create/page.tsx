import type { Metadata } from "next";
import { CreateSessionForm } from "@/components/sessions/create-session-form";
import { FormShell } from "@/components/layout/form-shell";
import { getServerI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> { const { t } = await getServerI18n(); return { title: t("create.meta") }; }

export default async function CreatePage() {
  const { t } = await getServerI18n();
  return <FormShell eyebrow={t("create.eyebrow")} title={t("create.title")} description={t("create.description")} wide><CreateSessionForm /></FormShell>;
}
