"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Copy, Dices, ListChecks, Radio, Users } from "lucide-react";
import { FormEvent, useState } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const rankedGames = [
  { name: "Deep Rock Galactic", detail: "Coop online · 4 pessoas", votes: 7, image: "https://cdn.akamai.steamstatic.com/steam/apps/548430/header.jpg", selected: true },
  { name: "Overcooked! 2", detail: "Coop local · Controle", votes: 5, image: "https://cdn.akamai.steamstatic.com/steam/apps/728880/header.jpg", selected: false },
  { name: "Lethal Company", detail: "Coop online · PC", votes: 4, image: "https://cdn.akamai.steamstatic.com/steam/apps/1966720/header.jpg", selected: false },
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
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <section className="border-b border-border">
          <div className="compact-320 mx-auto grid max-w-[var(--content-max)] gap-12 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[.88fr_1.12fr] lg:items-center lg:gap-16 lg:py-20">
            <div className="listed-enter">
              <div className="mb-7 flex items-center gap-3">
                <span className="h-px w-9 bg-primary" />
                <p className="listed-eyebrow">Uma decisão compartilhada</p>
              </div>
              <h1 className="max-w-xl text-[clamp(2.8rem,7vw,5.4rem)] font-semibold leading-[.92] tracking-[-.065em]">
                Liste.<br />Vote. <span className="text-primary">Jogue.</span>
              </h1>
              <p className="mt-7 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                Crie uma lista com seus amigos, descubra quais jogos funcionam para o grupo e escolha o próximo sem perder tempo.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg"><Link href="/create">Criar uma lista <ArrowRight className="size-4" /></Link></Button>
                <Button asChild variant="secondary" size="lg"><Link href="/join">Entrar em uma lista</Link></Button>
              </div>

              <form onSubmit={join} className="mt-9 max-w-md border-t border-border pt-6">
                <label htmlFor="session-code" className="listed-eyebrow">Já recebeu um código?</label>
                <div className="mt-3 flex gap-2">
                  <Input id="session-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 6))} placeholder="7KQ9XM" maxLength={6} className="font-mono uppercase tracking-[.2em]" autoComplete="off" />
                  <Button type="submit" variant="secondary" aria-label="Entrar com código" disabled={code.length !== 6}><ArrowRight className="size-4" /></Button>
                </div>
              </form>
            </div>

            <div className="listed-enter overflow-hidden rounded-xl border border-border bg-card [animation-delay:90ms]">
              <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-5">
                <div>
                  <p className="listed-eyebrow">Lista ao vivo</p>
                  <h2 className="mt-1.5 text-lg font-semibold tracking-tight">Sexta sem “tanto faz”</h2>
                </div>
                <button className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-xs font-semibold tracking-wider transition-colors hover:border-primary" aria-label="Copiar código 7KQ9XM">
                  7KQ9XM <Copy className="size-3.5" />
                </button>
              </div>

              <div className="flex items-center justify-between border-b border-border bg-secondary/35 px-4 py-3 text-xs text-muted-foreground sm:px-5">
                <span className="flex items-center gap-2"><Radio className="size-3.5 text-success" /> 5 pessoas online</span>
                <span className="tabular">3 de 5 votaram</span>
              </div>

              <ol aria-label="Jogos mais votados">
                {rankedGames.map((game, index) => (
                  <li key={game.name} className="selection-rail grid grid-cols-[2rem_4.5rem_1fr_auto] items-center gap-3 border-b border-border py-3 pl-4 pr-3 transition-colors hover:bg-secondary/35 sm:grid-cols-[2.5rem_6rem_1fr_auto] sm:gap-4 sm:pl-5 sm:pr-5" data-active={game.selected}>
                    <span className="font-mono text-xs font-semibold text-muted-foreground">0{index + 1}</span>
                    <div className="relative aspect-[16/9] overflow-hidden rounded-md bg-secondary">
                      <Image src={game.image} alt="" fill sizes="96px" className="object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold sm:text-base">{game.name}</p>
                      <p className="mt-1 truncate text-[11px] text-muted-foreground sm:text-xs">{game.detail}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right"><strong className="tabular block font-mono text-lg leading-none">{game.votes}</strong><span className="text-[10px] text-muted-foreground">votos</span></div>
                      <span className={`grid size-8 place-items-center rounded-md border ${game.selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"}`}><Check className="size-4" /></span>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center sm:px-5">
                <p className="text-xs leading-5 text-muted-foreground">Todos têm acesso ao primeiro colocado.</p>
                <Button variant="secondary" size="sm"><Dices className="size-3.5" /> Sortear finalistas</Button>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-card">
          <div className="mx-auto max-w-[var(--content-max)] px-4 py-12 sm:px-6 sm:py-16">
            <div className="grid border-y border-border md:grid-cols-3 md:divide-x md:divide-border">
              {[
                [ListChecks, "Monte a lista", "Steam, console ou jogo manual. Tudo entra no mesmo lugar."],
                [Users, "Encontre o consenso", "Veja propriedade, presença e votos sem atualizar a página."],
                [Dices, "Feche a escolha", "Vote, filtre ou sorteie. O resultado fica registrado."],
              ].map(([Icon, title, text], index) => {
                const FeatureIcon = Icon as typeof ListChecks;
                return (
                  <div key={String(title)} className="grid grid-cols-[2.5rem_1fr] gap-4 border-b border-border py-7 last:border-b-0 md:border-b-0 md:px-7 md:first:pl-0 md:last:pr-0">
                    <span className="font-mono text-xs text-primary">0{index + 1}</span>
                    <div><FeatureIcon className="mb-4 size-5 text-foreground" /><h2 className="font-semibold">{String(title)}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{String(text)}</p></div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
      <footer className="compact-320 mx-auto flex max-w-[var(--content-max)] flex-col gap-3 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p><strong className="font-semibold text-foreground">Listed</strong> — a lista que termina em jogo.</p>
        <nav className="flex gap-5" aria-label="Links legais"><Link href="/privacy" className="hover:text-foreground">Privacidade</Link><Link href="/terms" className="hover:text-foreground">Termos</Link></nav>
      </footer>
    </div>
  );
}
