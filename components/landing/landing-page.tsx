"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ClipboardCheck, Copy, ExternalLink, Gamepad2, LibraryBig, ListChecks, Radio, Sparkles, Users, Vote } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n/client";
import type { LandingDemoGame } from "@/lib/landing/demo-games";

const DEMO_CODE = "7KQ9XM";
const votes = [7, 5, 4];
const ownership = [
  [true, true, true, true, true],
  [true, true, true, false, true],
  [true, false, true, true, true],
];
const people = ["L", "N", "B", "C", "V"];

function GameArtwork({ game, priority = false }: { game: LandingDemoGame; priority?: boolean }) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  const source = game.capsuleImageUrl ?? game.headerImageUrl;
  if (!source || failed) {
    return <div className="grid h-full w-full place-items-center bg-[linear-gradient(135deg,color-mix(in_srgb,var(--primary)_30%,var(--card)),var(--secondary))]" role="img" aria-label={t("game.imageUnavailable")}><Gamepad2 className="size-6 text-foreground/50" /></div>;
  }
  return <Image src={source} alt={t("game.coverAlt", { game: game.name })} fill sizes="(max-width: 640px) 88px, 128px" className="object-cover transition-transform duration-300 group-hover:scale-[1.035] motion-reduce:transition-none" priority={priority} onError={() => setFailed(true)} />;
}

export function LandingPage({ games }: { games: LandingDemoGame[] }) {
  const router = useRouter();
  const { t, plural } = useI18n();
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState(0);
  const selectedGame = games[selected] ?? games[0];
  const steps = useMemo(() => [
    [LibraryBig, "landing.step1.title", "landing.step1.text"],
    [ListChecks, "landing.step2.title", "landing.step2.text"],
    [Users, "landing.step3.title", "landing.step3.text"],
    [Vote, "landing.step4.title", "landing.step4.text"],
    [Sparkles, "landing.step5.title", "landing.step5.text"],
  ] as const, []);

  function join(event: FormEvent) {
    event.preventDefault();
    const normalized = code.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 6);
    if (normalized.length === 6) router.push(`/join?code=${normalized}`);
  }

  async function copyDemoCode() {
    await navigator.clipboard?.writeText(DEMO_CODE);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_800);
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main-content">
        <section className="landing-stage relative isolate overflow-hidden border-b border-border">
          <div aria-hidden="true" className="landing-grid pointer-events-none absolute inset-0 -z-20" />
          <div aria-hidden="true" className="landing-orbit landing-orbit-one pointer-events-none absolute -z-10" />
          <div aria-hidden="true" className="landing-orbit landing-orbit-two pointer-events-none absolute -z-10" />
          <div className="compact-320 mx-auto grid max-w-[var(--content-max)] gap-12 px-4 py-12 sm:px-6 sm:py-16 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[.8fr_1.2fr] lg:items-center lg:gap-14 lg:py-16">
            <div className="listed-enter relative z-10">
              <div className="mb-6 flex items-center gap-3"><span className="h-px w-9 bg-primary" /><p className="listed-eyebrow">{t("landing.eyebrow")}</p></div>
              <h1 className="max-w-[12ch] text-[clamp(2.9rem,6.5vw,5.6rem)] font-semibold leading-[.91] tracking-[-.067em] text-balance">{t("landing.title")}</h1>
              <p className="mt-7 max-w-[34rem] text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">{t("landing.subtitle")}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg"><Link href="/create">{t("landing.create")} <ArrowRight className="size-4" /></Link></Button>
                <Button asChild variant="secondary" size="lg"><Link href="/join">{t("landing.join")}</Link></Button>
              </div>
              <form onSubmit={join} className="mt-9 max-w-md border-t border-border/80 pt-6">
                <label htmlFor="session-code" className="listed-eyebrow">{t("landing.haveCode")}</label>
                <div className="mt-3 flex gap-2">
                  <Input id="session-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 6))} placeholder={DEMO_CODE} maxLength={6} className="bg-background/80 font-mono uppercase tracking-[.2em] backdrop-blur-sm" autoComplete="off" />
                  <Button type="submit" variant="secondary" aria-label={t("landing.joinWithCode")} disabled={code.length !== 6}><ArrowRight className="size-4" /></Button>
                </div>
              </form>
            </div>

            <div className="listed-enter landing-console relative overflow-hidden rounded-[1.35rem] border border-border bg-card shadow-2xl [animation-delay:90ms]">
              <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-5">
                <div><div className="flex items-center gap-2"><span className="rounded-full bg-primary/12 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[.14em] text-primary">{t("landing.demo.label")}</span><p className="listed-eyebrow">{t("landing.demo.live")}</p></div><h2 className="mt-2 text-lg font-semibold tracking-tight sm:text-xl">{t("landing.demo.title")}</h2></div>
                <button type="button" onClick={() => void copyDemoCode()} className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2 font-mono text-xs font-semibold tracking-wider transition-colors hover:border-primary" aria-label={t("landing.demo.copy", { code: DEMO_CODE })}>
                  {DEMO_CODE} {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                  <span className="sr-only" aria-live="polite">{copied ? t("landing.demo.copied") : ""}</span>
                </button>
              </div>
              <div className="flex items-center justify-between border-b border-border bg-secondary/35 px-4 py-3 text-xs text-muted-foreground sm:px-5"><span className="flex items-center gap-2"><Radio className="size-3.5 text-success" /> {t("landing.demo.online")}</span><span className="tabular">{t("landing.demo.voted")}</span></div>

              <div className="grid lg:grid-cols-[1.15fr_.85fr]">
                <ol aria-label={t("landing.demo.ranking")} className="border-border lg:border-r">
                  {games.map((game, index) => (
                    <li key={game.appid}>
                      <button type="button" onClick={() => setSelected(index)} className="group selection-rail grid w-full grid-cols-[1.7rem_5.6rem_1fr_auto] items-center gap-2.5 border-b border-border py-3 pl-3 pr-3 text-left transition-colors hover:bg-secondary/40 sm:grid-cols-[2rem_7.5rem_1fr_auto] sm:gap-3.5 sm:pl-4" data-active={selected === index} aria-pressed={selected === index}>
                        <span className="sr-only">{t("landing.demo.vote", { game: game.name })}</span>
                        <span className="font-mono text-[10px] font-bold text-muted-foreground">0{index + 1}</span>
                        <span className="relative aspect-[92/43] overflow-hidden rounded-md bg-secondary sm:aspect-[120/45]"><GameArtwork game={game} priority={index === 0} /></span>
                        <span className="min-w-0"><strong className="block text-sm leading-5 sm:text-[15px]">{game.name}</strong><span className="mt-1 block font-mono text-[10px] text-muted-foreground">APPID {game.appid}{game.releaseYear ? ` · ${game.releaseYear}` : ""}</span></span>
                        <span className="flex items-center gap-2"><span className="text-right"><strong className="tabular block font-mono text-base leading-none">{votes[index]}</strong><span className="text-[9px] text-muted-foreground">{plural("landing.demo.voteUnit.one", "landing.demo.voteUnit.other", votes[index])}</span></span><span className={`grid size-7 place-items-center rounded-md border ${selected === index ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"}`}><Check className="size-3.5" /></span></span>
                      </button>
                    </li>
                  ))}
                </ol>

                <aside className="flex min-h-48 flex-col bg-secondary/15 p-4 sm:p-5" aria-label={t("landing.demo.ownership")}>
                  <div className="flex items-start justify-between gap-3"><div><p className="listed-eyebrow">{t("landing.demo.pick")}</p><h3 className="mt-1.5 font-semibold">{selectedGame?.name}</h3></div><ClipboardCheck className="size-5 text-primary" /></div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{t("landing.demo.pickDescription")}</p>
                  <div className="mt-5 grid grid-cols-5 gap-2" role="group" aria-label={t("landing.demo.ownerNames")}>
                    {people.map((person, personIndex) => <span key={person} className={`grid aspect-square place-items-center rounded-full border font-mono text-[10px] font-bold ${ownership[selected]?.[personIndex] ? "border-success/40 bg-success/10 text-success" : "border-border bg-background text-muted-foreground"}`}>{ownership[selected]?.[personIndex] ? <Check className="size-3.5" /> : person}</span>)}
                  </div>
                  <div className="mt-auto pt-5 text-[11px] leading-5 text-muted-foreground">
                    <p>{selectedGame?.platforms.length ? selectedGame.platforms.join(" · ") : t("landing.demo.detailsUnavailable")}</p>
                    {selectedGame?.metadataAvailable ? <p>{plural("common.genre.one", "common.genre.other", selectedGame.genresCount)} · {plural("common.category.one", "common.category.other", selectedGame.categoriesCount)}</p> : null}
                  </div>
                  {selectedGame ? <a href={selectedGame.storeUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-foreground underline decoration-border underline-offset-4 hover:decoration-primary">{t("steam.open")} <ExternalLink className="size-3" /></a> : null}
                </aside>
              </div>
              <div className="flex flex-col gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"><p className="text-xs font-medium">{selected === 0 ? t("landing.demo.everyone") : t("landing.demo.pickDescription")}</p><p className="max-w-sm text-[10px] leading-4 text-muted-foreground">{t("landing.demo.realData")}</p></div>
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-card">
          <div className="mx-auto max-w-[var(--content-max)] px-4 py-14 sm:px-6 sm:py-20">
            <div className="max-w-2xl"><p className="listed-eyebrow">{t("landing.steps.eyebrow")}</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">{t("landing.steps.title")}</h2><p className="mt-4 leading-7 text-muted-foreground">{t("landing.steps.description")}</p></div>
            <ol className="mt-10 grid border-y border-border sm:grid-cols-2 lg:grid-cols-5 lg:divide-x lg:divide-border">
              {steps.map(([Icon, title, description], index) => <li key={title} className="group relative border-b border-border p-5 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 lg:border-b-0 lg:p-6"><span className="font-mono text-[10px] font-bold text-primary">0{index + 1}</span><Icon className="mt-8 size-5 transition-transform group-hover:-translate-y-1 motion-reduce:transition-none" /><h3 className="mt-4 font-semibold">{t(title)}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{t(description)}</p></li>)}
            </ol>
          </div>
        </section>
      </main>
      <footer className="compact-320 mx-auto flex max-w-[var(--content-max)] flex-col gap-3 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6"><p><strong className="font-semibold text-foreground">Listed</strong> — {t("landing.footer")}</p><nav className="flex gap-5" aria-label={t("nav.legal")}><Link href="/privacy" className="hover:text-foreground">{t("nav.privacy")}</Link><Link href="/terms" className="hover:text-foreground">{t("nav.terms")}</Link></nav></footer>
    </div>
  );
}
