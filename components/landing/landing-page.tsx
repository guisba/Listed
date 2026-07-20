"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Copy, Dices, Gamepad2, Layers3, Sparkles, Users, Vote } from "lucide-react";
import { FormEvent, useState } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const games = [
  { name: "Deep Rock Galactic", tags: ["Coop online", "4 jogadores"], votes: 7, hue: "from-amber-500/80 to-orange-950" },
  { name: "Overcooked! 2", tags: ["Coop local", "Controle"], votes: 5, hue: "from-sky-500/80 to-indigo-950" },
  { name: "Lethal Company", tags: ["Coop online", "PC"], votes: 4, hue: "from-rose-500/70 to-zinc-950" },
];

export function LandingPage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function join(event: FormEvent) {
    event.preventDefault();
    const normalized = code.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 6);
    if (normalized.length === 6) router.push(`/join?code=${normalized}`);
  }

  return (
    <div className="min-h-screen overflow-hidden bg-background">
      <SiteHeader />
      <main>
        <section className="relative isolate">
          <div className="hero-glow" aria-hidden="true" />
          <div className="mx-auto grid max-w-7xl gap-14 px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:grid-cols-[1.03fr_.97fr] lg:items-center lg:pb-28">
            <div className="relative z-10">
              <Badge className="mb-6 border-primary/25 bg-primary/10 text-primary">
                <Sparkles className="mr-1.5 size-3.5" /> Decidir ficou divertido
              </Badge>
              <h1 className="max-w-3xl text-balance text-5xl font-black leading-[.96] tracking-[-.055em] sm:text-7xl">
                Menos debate.<br />Mais <span className="text-gradient">partida.</span>
              </h1>
              <p className="mt-7 max-w-xl text-balance text-lg leading-8 text-muted-foreground sm:text-xl">
                Reúna a biblioteca da galera, descubra o que todo mundo pode jogar e escolha o jogo da noite sem cair no looping do “tanto faz”.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg"><Link href="/create">Criar uma sessão <ArrowRight className="size-4" /></Link></Button>
                <Button asChild variant="secondary" size="lg"><Link href="/join">Entrar com código</Link></Button>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-2"><Check className="size-4 text-primary" /> Sem cadastro obrigatório</span>
                <span className="flex items-center gap-2"><Check className="size-4 text-primary" /> Tempo real</span>
                <span className="flex items-center gap-2"><Check className="size-4 text-primary" /> Steam + jogos manuais</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-xl lg:mx-0">
              <div className="absolute -inset-5 rounded-[2.5rem] bg-primary/10 blur-3xl" aria-hidden="true" />
              <Card className="relative overflow-hidden border-white/10 bg-card/80 shadow-[0_45px_100px_-40px_rgba(0,0,0,.8)] backdrop-blur-xl">
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[.18em] text-muted-foreground">Sessão ativa</p>
                    <h2 className="mt-1 font-bold">Sextou sem desculpa</h2>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 font-mono text-xs"><span className="size-2 rounded-full bg-emerald-400" /> 7KQ9XM <Copy className="size-3" /></div>
                </div>
                <CardContent className="space-y-3">
                  <div className="mb-5 flex items-center justify-between text-sm text-muted-foreground"><span className="flex items-center gap-2"><Users className="size-4" /> 5 pessoas online</span><span>3 de 5 votaram</span></div>
                  {games.map((game, index) => (
                    <div key={game.name} className="group flex items-center gap-3 rounded-2xl border border-border bg-background/45 p-3 transition hover:border-primary/35">
                      <div className={`grid size-16 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${game.hue} text-white shadow-lg`}><Gamepad2 className="size-6" /></div>
                      <div className="min-w-0 flex-1"><h3 className="truncate font-bold">{game.name}</h3><div className="mt-2 flex flex-wrap gap-1">{game.tags.map((tag) => <span key={tag} className="rounded-md bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{tag}</span>)}</div></div>
                      <div className="text-center"><p className="font-mono text-xl font-black text-primary">{game.votes}</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground">votos</p></div>
                      <div className={`grid size-7 place-items-center rounded-full border text-xs font-black ${index === 0 ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>{index === 0 ? <Check className="size-4" /> : "+"}</div>
                    </div>
                  ))}
                  <Button className="mt-4 w-full" variant="secondary"><Dices className="size-4" /> Sortear entre os mais votados</Button>
                </CardContent>
              </Card>
              <div className="absolute -bottom-5 -left-4 rounded-2xl border border-border bg-card px-4 py-3 shadow-xl sm:-left-10"><p className="text-xs text-muted-foreground">Mais votado agora</p><p className="font-bold">⛏️ Deep Rock Galactic</p></div>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-secondary/25">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-16 sm:grid-cols-3 sm:px-6">
            {[
              [Layers3, "Junte tudo", "Steam, console ou aquele jogo obscuro de navegador — todos cabem na mesma lista."],
              [Vote, "Filtre e vote", "Veja o que funciona para o grupo, marque propriedade e vote em tempo real."],
              [Dices, "Decida do seu jeito", "Votação, sorteio simples ou ponderado, ranking, veto e mais."],
            ].map(([Icon, title, text]) => {
              const FeatureIcon = Icon as typeof Layers3;
              return <div key={String(title)} className="rounded-3xl p-5"><div className="mb-5 grid size-12 place-items-center rounded-2xl bg-primary/12 text-primary"><FeatureIcon className="size-5" /></div><h2 className="text-lg font-bold">{String(title)}</h2><p className="mt-2 leading-7 text-muted-foreground">{String(text)}</p></div>;
            })}
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
          <p className="text-sm font-bold uppercase tracking-[.2em] text-primary">Já tem uma sala?</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Entre antes que escolham sem você.</h2>
          <form onSubmit={join} className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="session-code">Código da sessão</label>
            <Input id="session-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="EX: 7KQ9XM" maxLength={6} className="font-mono uppercase tracking-[.2em]" autoComplete="off" />
            <Button type="submit" disabled={code.replace(/[^A-Z2-9]/g, "").length !== 6}>Entrar</Button>
          </form>
        </section>
      </main>
      <footer className="border-t border-border px-4 py-8 text-center text-sm text-muted-foreground">JogaJunto — uma lista compartilhada para a próxima boa história.</footer>
    </div>
  );
}
