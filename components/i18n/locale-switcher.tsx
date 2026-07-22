"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, Languages, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { SUPPORTED_LOCALES, type Locale } from "@/i18n/config";
import { Button } from "@/components/ui/button";

export function LocaleSwitcher() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [pending, setPending] = useState<Locale | null>(null);

  async function chooseLocale(nextLocale: Locale) {
    if (nextLocale === locale || pending) return;
    setPending(nextLocale);
    try {
      const response = await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
      });
      if (!response.ok) return;
      document.documentElement.lang = nextLocale;
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("locale.choose")} title={t("locale.current", { language: locale })}>
          {pending ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-label={t("locale.changing")} /> : <Languages className="size-4" />}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 min-w-56 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl">
          {SUPPORTED_LOCALES.map((option) => (
            <DropdownMenu.Item key={option} onSelect={() => void chooseLocale(option)} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none transition-colors hover:bg-accent focus:bg-accent">
              <span className="w-11 font-mono text-[11px] font-semibold text-muted-foreground">{option}</span>
              <span className="flex-1">{t(option === "pt-BR" ? "locale.ptBR" : "locale.enUS")}</span>
              {locale === option ? <Check className="size-4 text-primary" /> : null}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
