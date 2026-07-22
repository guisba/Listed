import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { FormShell } from "@/components/layout/form-shell";
import { getServerI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> { const { t } = await getServerI18n(); return { title: t("login.meta") }; }

export default async function LoginPage() {
  const { t } = await getServerI18n();
  return <FormShell eyebrow={t("login.eyebrow")} title={t("login.title")} description={t("login.description")}><LoginForm /></FormShell>;
}
