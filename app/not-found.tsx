"use client";

import Link from "next/link";
import { ListX } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";

export default function NotFound() {
  const { t } = useI18n();
  return <div className="min-h-screen"><SiteHeader /><main id="main-content" className="grid min-h-[calc(100vh-4rem)] place-items-center px-4"><div className="max-w-md text-center"><ListX className="mx-auto size-10 text-primary" /><h1 className="mt-5 text-3xl font-semibold tracking-[-.04em]">{t("notFound.title")}</h1><p className="mt-3 leading-7 text-muted-foreground">{t("notFound.description")}</p><Button asChild className="mt-7"><Link href="/">{t("notFound.action")}</Link></Button></div></main></div>;
}
