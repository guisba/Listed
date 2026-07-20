import type { Metadata } from "next";
import Link from "next/link";
import { Gamepad2 } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return <main className="min-h-screen px-4 py-6 sm:grid sm:place-items-center"><div className="w-full max-w-md"><div className="mb-10 flex items-center justify-between"><Link href="/" className="flex items-center gap-2 font-black"><span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Gamepad2 className="size-5" /></span>JogaJunto</Link><ThemeSwitcher /></div><p className="text-sm font-bold uppercase tracking-[.18em] text-primary">Conta permanente</p><h1 className="mt-2 text-3xl font-black tracking-tight">Leve sua galera com você.</h1><p className="mb-7 mt-3 text-muted-foreground">Salve grupos, biblioteca e histórico em todos os dispositivos.</p><Card><CardContent><LoginForm /></CardContent></Card></div></main>;
}
