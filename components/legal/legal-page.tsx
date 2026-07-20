import Link from "next/link";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/layout/site-header";

export function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return <div className="min-h-screen"><SiteHeader /><main className="mx-auto max-w-3xl px-4 py-14 sm:px-6"><p className="text-sm font-bold uppercase tracking-[.18em] text-primary">JogaJunto</p><h1 className="mt-2 text-4xl font-black tracking-tight">{title}</h1><p className="mt-5 text-lg leading-8 text-muted-foreground">{intro}</p><article className="mt-10 space-y-8 leading-7 text-muted-foreground">{children}</article><Link href="/" className="mt-12 inline-block font-semibold text-primary hover:underline">← Voltar ao início</Link></main></div>;
}
