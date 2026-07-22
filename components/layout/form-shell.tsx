"use client";

import type { ReactNode } from "react";
import { ListedLogo } from "@/components/brand/listed-logo";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { useI18n } from "@/i18n/client";

interface FormShellProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

export function FormShell({ eyebrow, title, description, children, footer, wide = false }: FormShellProps) {
  const { t } = useI18n();
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="compact-320 mx-auto flex h-16 max-w-[var(--content-max)] items-center justify-between px-4 sm:px-6"><ListedLogo /><div className="flex items-center"><LocaleSwitcher /><ThemeSwitcher /></div></div>
      </header>
      <div className={`compact-320 mx-auto grid max-w-[var(--content-max)] gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:items-start lg:gap-14 ${wide ? "lg:grid-cols-[.7fr_1.3fr]" : "lg:grid-cols-[.85fr_1.15fr]"}`}>
        <section className="lg:sticky lg:top-28">
          <p className="listed-eyebrow flex items-center gap-3"><span className="h-px w-7 bg-primary" />{eyebrow}</p>
          <h1 className="mt-5 max-w-lg text-4xl font-semibold leading-[1.02] tracking-[-.05em] sm:text-5xl">{title}</h1>
          <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground">{description}</p>
          <div className="mt-8 hidden whitespace-pre-line border-t border-border pt-5 text-xs leading-5 text-muted-foreground lg:block">{t("form.quickNotice")}</div>
        </section>
        <section className="listed-surface rounded-xl border border-border bg-card p-5 sm:p-7">{children}</section>
        {footer ? <div className="text-center text-sm text-muted-foreground lg:col-start-2">{footer}</div> : null}
      </div>
    </main>
  );
}
