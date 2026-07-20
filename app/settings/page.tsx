import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Configurações" };

export default function SettingsPage() {
  return <div className="min-h-screen"><SiteHeader /><main className="mx-auto max-w-2xl px-4 py-14 sm:px-6"><p className="text-sm font-bold uppercase tracking-[.18em] text-primary">Preferências</p><h1 className="mt-2 text-4xl font-black tracking-tight">Configurações</h1><Card className="mt-8"><CardContent className="flex items-center justify-between"><div><h2 className="font-bold">Tema da interface</h2><p className="mt-1 text-sm text-muted-foreground">Claro, escuro ou escuro vermelho. A preferência fica neste dispositivo.</p></div><ThemeSwitcher /></CardContent></Card></main></div>;
}
