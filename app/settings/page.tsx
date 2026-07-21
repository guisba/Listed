import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";

export const metadata: Metadata = { title: "Configurações" };

export default function SettingsPage() {
  return <div className="min-h-screen"><SiteHeader /><main className="mx-auto max-w-3xl px-4 py-12 sm:px-6"><p className="listed-eyebrow">Preferências</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.04em]">Configurações</h1><section className="mt-9 grid gap-5 border-y border-border py-6 sm:grid-cols-[1fr_auto] sm:items-center"><div><h2 className="font-semibold">Aparência do Listed</h2><p className="mt-1 max-w-lg text-sm leading-6 text-muted-foreground">A escolha fica neste dispositivo e é sincronizada com o perfil quando você usa uma conta permanente.</p></div><ThemeSwitcher /></section><section className="py-6"><h2 className="font-semibold">Movimento</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">O Listed respeita automaticamente a preferência “reduzir movimento” do seu dispositivo.</p></section></main></div>;
}
