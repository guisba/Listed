import type { Metadata } from "next";
import Link from "next/link";
import { Gamepad2 } from "lucide-react";
import { JoinSessionForm } from "@/components/sessions/join-session-form";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Entrar em uma sessão" };

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code = "" } = await searchParams;
  return <main className="min-h-screen px-4 py-6 sm:grid sm:place-items-center"><div className="w-full max-w-md"><div className="mb-10 flex items-center justify-between"><Link href="/" className="flex items-center gap-2 font-black"><span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Gamepad2 className="size-5" /></span>JogaJunto</Link><ThemeSwitcher /></div><p className="text-sm font-bold uppercase tracking-[.18em] text-primary">Você foi convidado</p><h1 className="mt-2 text-3xl font-black tracking-tight">Chega mais.</h1><p className="mb-7 mt-3 text-muted-foreground">Use o código compartilhado pela sua galera para entrar na sala.</p><Card><CardContent><JoinSessionForm initialCode={code} /></CardContent></Card><p className="mt-6 text-center text-sm text-muted-foreground">Ainda não existe uma sala? <Link href="/create" className="font-semibold text-primary hover:underline">Crie a sua</Link></p></div></main>;
}
