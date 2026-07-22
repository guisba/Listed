"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

export function ListedMark({ className }: { className?: string }) {
  return <span className={cn("brand-mark", className)} aria-hidden="true"><span /><span /><span /></span>;
}

export function ListedLogo({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { t } = useI18n();
  return (
    <Link href="/" className={cn("brand-lockup inline-flex items-center gap-2.5 font-semibold tracking-[-.03em]", className)} aria-label={t("nav.home")}>
      <ListedMark />
      <span className={compact ? "hidden sm:inline" : undefined}>Listed</span>
    </Link>
  );
}
