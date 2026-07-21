"use client";

import Image from "next/image";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Check,
  ExternalLink,
  Gamepad2,
  LoaderCircle,
  Monitor,
  PackageSearch,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useId, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SteamGamePreview, SteamSearchMatch } from "@/lib/steam/types";

interface Props {
  sessionId: string;
  onAdded: () => void;
  onCancel: () => void;
  onManualFallback: () => void;
}

interface CatalogMetadata {
  status: "complete" | "syncing" | "partial" | "empty" | "failed" | "unknown";
  provider?: "official_store_service" | "legacy_public_applist";
  indexedGames: number;
  lastSyncAt: string | null;
}

interface SearchPayload {
  error?: string;
  code?: string;
  kind?: "matches" | "preview";
  games?: Array<SteamSearchMatch | SteamGamePreview>;
  catalog?: CatalogMetadata;
  pagination?: { limit: number; offset: number; total: number; hasMore: boolean };
}

function isPreview(game: SteamSearchMatch | SteamGamePreview): game is SteamGamePreview {
  return "storeUrl" in game;
}

function HighlightedName({ name, query }: { name: string; query: string }) {
  const index = name.toLocaleLowerCase().indexOf(query.trim().toLocaleLowerCase());
  if (index < 0 || !query.trim()) return name;
  return (
    <>
      {name.slice(0, index)}
      <mark className="rounded-sm bg-primary/15 px-0.5 text-foreground">{name.slice(index, index + query.trim().length)}</mark>
      {name.slice(index + query.trim().length)}
    </>
  );
}

function ResultSkeletons() {
  return (
    <div aria-label="Buscando jogos" className="space-y-2 p-3">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex h-[76px] animate-pulse gap-3 rounded-xl border border-border/60 p-2.5">
          <div className="h-12 w-[92px] shrink-0 rounded-lg bg-secondary" />
          <div className="min-w-0 flex-1 space-y-2 py-1"><div className="h-3 w-4/5 rounded bg-secondary" /><div className="h-2.5 w-2/5 rounded bg-secondary" /></div>
        </div>
      ))}
    </div>
  );
}

function CatalogNotice({ catalog }: { catalog: CatalogMetadata | null }) {
  if (!catalog || catalog.status === "complete") return null;
  const message = catalog.status === "syncing" || catalog.status === "partial"
    ? "O catálogo Steam ainda está sendo atualizado. Alguns jogos podem não aparecer."
    : catalog.status === "empty"
      ? "O catálogo Steam ainda não foi sincronizado."
      : catalog.status === "failed"
        ? "A busca por nome está temporariamente limitada. Você ainda pode usar um AppID ou link da Steam."
        : "O estado do catálogo Steam não está disponível. AppID e links oficiais continuam disponíveis.";
  return <p className="border-b border-border bg-amber-500/10 px-4 py-2.5 text-xs leading-5 text-amber-800 dark:text-amber-200">{message}</p>;
}

function FeatureSummary({ preview }: { preview: SteamGamePreview }) {
  const labels: Record<string, string> = {
    singleplayer: "Um jogador",
    "coop-local": "Coop local",
    "coop-online": "Coop online",
    multiplayer: "Multiplayer",
    "controller-support": "Controle",
  };
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {Object.entries(labels).map(([feature, label]) => (
        <div key={feature} className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs ${preview.features.includes(feature) ? "border-primary/35 bg-primary/5 text-foreground" : "border-border text-muted-foreground opacity-55"}`}>
          {feature.includes("coop") || feature === "multiplayer" ? <Users className="size-3.5" /> : feature === "controller-support" ? <Gamepad2 className="size-3.5" /> : <Monitor className="size-3.5" />}
          {label}
        </div>
      ))}
    </div>
  );
}

export function SteamGamePicker({ sessionId, onAdded, onCancel, onManualFallback }: Props) {
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<SteamSearchMatch[]>([]);
  const [preview, setPreview] = useState<SteamGamePreview | null>(null);
  const [catalog, setCatalog] = useState<CatalogMetadata | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const skipNextDebouncedSearch = useRef(false);

  const requestGames = useCallback(async (value: string, signal?: AbortSignal, offset = 0) => {
    const sequence = ++requestSequence.current;
    if (offset > 0) setLoadingMore(true);
    else setLoading(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/steam/search?q=${encodeURIComponent(value)}&limit=12&offset=${offset}`, { signal });
      const payload = await response.json() as SearchPayload;
      if (!response.ok) throw new Error(payload.error ?? "Busca Steam indisponível.");
      if (sequence !== requestSequence.current) return;
      setCatalog(payload.catalog ?? null);
      const games = payload.games ?? [];
      if (payload.kind === "preview" && games[0] && isPreview(games[0])) {
        setPreview(games[0]);
        setActiveIndex(-1);
      } else {
        const nextMatches = games.filter((game): game is SteamSearchMatch => !isPreview(game));
        setPreview(null);
        setMatches((current) => offset > 0 ? [...current, ...nextMatches] : nextMatches);
        setActiveIndex(nextMatches.length && offset === 0 ? 0 : -1);
        setHasMore(Boolean(payload.pagination?.hasMore));
        if (!nextMatches.length && offset === 0) setStatus("Nenhum jogo encontrado no índice Steam disponível.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (sequence !== requestSequence.current) return;
      if (offset === 0) {
        setMatches([]);
        setPreview(null);
      }
      setStatus(error instanceof Error ? error.message : "Erro ao pesquisar na Steam.");
    } finally {
      if (sequence === requestSequence.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    controller.current?.abort();
    const value = query.trim();
    if (value.length < 2) return;
    if (skipNextDebouncedSearch.current) {
      skipNextDebouncedSearch.current = false;
      return;
    }
    const nextController = new AbortController();
    controller.current = nextController;
    const timeout = window.setTimeout(() => requestGames(value, nextController.signal), 320);
    return () => {
      window.clearTimeout(timeout);
      nextController.abort();
    };
  }, [query, requestGames]);

  function updateQuery(value: string) {
    setQuery(value);
    if (value.trim().length >= 2) return;
    controller.current?.abort();
    requestSequence.current += 1;
    setMatches([]);
    setPreview(null);
    setStatus(null);
    setHasMore(false);
    setLoading(false);
  }

  async function selectMatch(match: SteamSearchMatch) {
    controller.current?.abort();
    skipNextDebouncedSearch.current = true;
    setQuery(match.name);
    await requestGames(String(match.appid));
  }

  async function addGame() {
    if (!preview) return;
    setAdding(true);
    setStatus(null);
    try {
      const response = await fetch("/api/steam/session-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, appid: preview.appid }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível adicionar o jogo.");
      onAdded();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível adicionar o jogo.");
    } finally {
      setAdding(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape" && matches.length) {
      setMatches([]);
      setActiveIndex(-1);
      return;
    }
    if (!matches.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, matches.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      void selectMatch(matches[activeIndex]);
    }
  }

  const searchPanel = (
    <section className={`${preview ? "hidden md:flex" : "flex"} min-h-0 flex-col border-border md:border-r`} aria-label="Resultados da pesquisa Steam">
      <div className="shrink-0 border-b border-border p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nome, AppID ou link da Steam"
            className="pl-9 pr-10"
            role="combobox"
            aria-label="Buscar jogo na Steam"
            aria-autocomplete="list"
            aria-expanded={matches.length > 0}
            aria-controls={listboxId}
            aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
          />
          {loading ? <LoaderCircle className="absolute right-3 top-3.5 size-4 animate-spin text-primary" aria-label="Buscando" /> : null}
        </div>
      </div>
      <CatalogNotice catalog={catalog} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading && !matches.length ? <ResultSkeletons /> : matches.length ? (
          <div id={listboxId} role="listbox" className="space-y-2 p-3">
            {matches.map((match, index) => (
              <button
                id={`${listboxId}-${index}`}
                key={match.appid}
                type="button"
                role="option"
                aria-selected={preview?.appid === match.appid || index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => void selectMatch(match)}
                className={`flex min-h-[76px] w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-[background-color,border-color,transform] hover:-translate-y-px ${preview?.appid === match.appid || index === activeIndex ? "border-primary/50 bg-primary/5" : "border-border hover:bg-accent"}`}
              >
                {match.headerImage ? (
                  <Image src={match.headerImage} alt="" width={184} height={86} loading="lazy" className="h-12 w-[92px] shrink-0 rounded-lg object-cover" />
                ) : <span className="grid h-12 w-[92px] shrink-0 place-items-center rounded-lg bg-secondary"><PackageSearch className="size-5" /></span>}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-5"><HighlightedName name={match.name} query={query} /></span>
                  <span className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                    <span>AppID {match.appid}</span>
                    <span>{match.releaseDate?.match(/\d{4}/)?.[0] ?? (match.type === "unknown" ? "Tipo será confirmado ao abrir a prévia" : "Jogo")}</span>
                    {match.platforms.slice(0, 2).map((platform) => <span key={platform}>{platform}</span>)}
                  </span>
                </span>
                <Check className={`size-4 shrink-0 text-primary ${preview?.appid === match.appid || index === activeIndex ? "opacity-100" : "opacity-0"}`} />
              </button>
            ))}
            {hasMore ? <Button type="button" variant="secondary" className="w-full" disabled={loadingMore} onClick={() => void requestGames(query, undefined, matches.length)}>{loadingMore ? <LoaderCircle className="size-4 animate-spin" /> : null} Carregar mais</Button> : null}
          </div>
        ) : (
          <div className="grid min-h-56 place-items-center px-6 text-center">
            <div><PackageSearch className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 text-sm font-semibold">{status ?? "Digite ao menos 2 caracteres"}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">A busca consulta o índice Steam no servidor. AppIDs e links oficiais funcionam mesmo antes do catálogo terminar.</p></div>
          </div>
        )}
      </div>
    </section>
  );

  const previewPanel = (
    <section className={`${preview ? "flex" : "hidden md:flex"} min-h-0 flex-col bg-secondary/20`} aria-label="Prévia do jogo Steam">
      {preview ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <button type="button" onClick={() => setPreview(null)} className="m-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground md:hidden"><ArrowLeft className="size-4" /> Voltar aos resultados</button>
            <div className="px-4 pb-5 pt-0 md:p-5">
              <article className="overflow-hidden rounded-2xl border border-border bg-card">
                {preview.headerImage ? <Image src={preview.headerImage} alt={`Imagem principal de ${preview.name}`} width={920} height={430} className="aspect-[2.15/1] w-full bg-secondary object-cover" priority sizes="(min-width: 768px) 58vw, 100vw" /> : <div className="grid aspect-[2.15/1] place-items-center bg-secondary"><PackageSearch className="size-10 text-muted-foreground" /></div>}
                <div className="space-y-5 p-5">
                  <div>
                    <p className="listed-eyebrow text-primary">Prévia Steam</p>
                    <h3 className="mt-1 text-2xl font-semibold tracking-[-.03em]">{preview.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">AppID {preview.appid} · {preview.type}</p>
                  </div>
                  {preview.shortDescription ? <p className="text-sm leading-6 text-muted-foreground">{preview.shortDescription}</p> : null}
                  {preview.fullDescription && preview.fullDescription !== preview.shortDescription ? <details className="rounded-xl border border-border p-3 text-sm text-muted-foreground"><summary className="cursor-pointer font-semibold text-foreground">Descrição completa</summary><p className="mt-3 leading-6">{preview.fullDescription}</p></details> : null}
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-xl bg-secondary/70 p-3"><dt className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="size-3.5" /> Lançamento</dt><dd className="mt-1.5 font-semibold">{preview.comingSoon ? "Em breve" : preview.releaseDate ?? "Não informado"}</dd></div>
                    <div className="rounded-xl bg-secondary/70 p-3"><dt className="text-xs text-muted-foreground">Preço</dt><dd className="mt-1.5 font-semibold">{preview.isFree ? "Gratuito" : preview.price?.formatted ?? "Consulte na Steam"}</dd></div>
                    <div className="rounded-xl bg-secondary/70 p-3"><dt className="text-xs text-muted-foreground">Desenvolvedora</dt><dd className="mt-1.5 font-semibold">{preview.developers.join(", ") || "Não informado"}</dd></div>
                    <div className="rounded-xl bg-secondary/70 p-3"><dt className="text-xs text-muted-foreground">Distribuidora</dt><dd className="mt-1.5 font-semibold">{preview.publishers.join(", ") || "Não informado"}</dd></div>
                  </dl>
                  <FeatureSummary preview={preview} />
                  {[{ label: "Plataformas", values: preview.platforms }, { label: "Gêneros", values: preview.genres }, { label: "Categorias", values: preview.categories }].map((section) => section.values.length ? (
                    <Fragment key={section.label}><div className="h-px bg-border" /><div><h4 className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{section.label}</h4><div className="mt-2 flex flex-wrap gap-1.5">{section.values.slice(0, 18).map((item) => <Badge key={item}>{item}</Badge>)}</div></div></Fragment>
                  ) : null)}
                  {preview.warning ? <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300"><AlertTriangle className="mt-.5 size-4 shrink-0" />{preview.warning}</p> : null}
                </div>
              </article>
            </div>
          </div>
          <footer className="grid shrink-0 grid-cols-1 gap-2 border-t border-border bg-card p-4 sm:grid-cols-3">
            <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
            <Button asChild variant="secondary"><a href={preview.storeUrl} target="_blank" rel="noreferrer">Abrir na Steam <ExternalLink className="size-4" /></a></Button>
            <Button type="button" onClick={() => void addGame()} disabled={adding}>{adding ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />} Adicionar à lista</Button>
          </footer>
        </>
      ) : (
        <div className="grid h-full place-items-center p-8 text-center"><div><PackageSearch className="mx-auto size-10 text-muted-foreground" /><h3 className="mt-4 font-semibold">Selecione um jogo</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">A prévia completa aparecerá aqui sem substituir a lista de resultados.</p></div></div>
      )}
    </section>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {searchPanel}
        {previewPanel}
      </div>
      {status && matches.length > 0 ? <div role="alert" className="shrink-0 border-t border-border bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{status}<button type="button" onClick={onManualFallback} className="ml-1 font-semibold underline">Adicionar manualmente</button></div> : null}
      {!preview ? <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-card p-4 md:hidden"><Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button><Button type="button" variant="secondary" onClick={onManualFallback}>Adicionar manualmente</Button></footer> : null}
    </div>
  );
}
