import type { Metadata } from "next";
import Link from "next/link";
import { Gamepad2 } from "lucide-react";
import { CreateSessionForm } from "@/components/sessions/create-session-form";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Criar sessão" };

export default function CreatePage() {
  return <main className="min-h-screen px-4 py-6 sm:grid sm:place-items-center sm:py-14"><div className="w-full max-w-2xl"><div className="mb-8 flex items-center justify-between"><Link href="/" className="flex items-center gap-2 font-black"><span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Gamepad2 className="size-5" /></span>JogaJunto</Link><ThemeSwitcher /></div><div className="mb-7"><p className="text-sm font-bold uppercase tracking-[.18em] text-primary">Nova sessão rápida</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">A noite começa aqui.</h1><p className="mt-3 text-muted-foreground">Em menos de um minuto, sua galera já pode adicionar jogos e votar.</p></div><Card><CardContent><CreateSessionForm /></CardContent></Card></div></main>;
}
