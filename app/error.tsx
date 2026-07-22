"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return <main className="grid min-h-screen place-items-center px-4"><div className="max-w-md text-center"><TriangleAlert className="mx-auto size-10 text-destructive" /><h1 className="mt-5 text-3xl font-semibold tracking-[-.04em]">{t("error.title")}</h1><p className="mt-3 leading-7 text-muted-foreground">{t("error.description")}</p><Button className="mt-7" onClick={reset}><RotateCcw className="size-4" /> {t("error.retry")}</Button></div></main>;
}
