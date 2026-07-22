import type { Metadata } from "next";
import Link from "next/link";
import { JoinSessionForm } from "@/components/sessions/join-session-form";
import { FormShell } from "@/components/layout/form-shell";
import { getServerI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> { const { t } = await getServerI18n(); return { title: t("join.meta") }; }

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code = "" } = await searchParams;
  const { t } = await getServerI18n();
  return <FormShell eyebrow={t("join.eyebrow")} title={t("join.title")} description={t("join.description")} footer={<>{t("join.noList")} <Link href="/create" className="font-semibold text-primary hover:underline">{t("join.createFirst")}</Link></>}><JoinSessionForm initialCode={code} /></FormShell>;
}
