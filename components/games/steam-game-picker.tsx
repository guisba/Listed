"use client";

import Image from "next/image";
import { AlertTriangle, Check, ExternalLink, LoaderCircle, PackageSearch, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SteamGamePreview, SteamSearchMatch } from "@/lib/steam/types";

interface Props {
  sessionId: string;
  onAdded: () => void;
  onManualFallback: () => void;
}

interface SearchPayload {
  error?: string;
  code?: string;
  kind?: "matches" | "preview";
  games?: Array<SteamSearchMatch | SteamGamePreview>;
}

function isPreview(game: SteamSearchMatch | SteamGamePreview): game is SteamGamePreview {
  return "storeUrl" in game;
}

export function SteamGamePicker({ sessionId, onAdded, onManualFallback }: Props) {
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<SteamSearchMatch[]>([]);
  const [preview, setPreview] = useState<SteamGamePreview | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const controller = useRef<AbortController | null>(null);

  const requestGames = useCallback(async (value: string, signal?: AbortSignal) => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/steam/search?q=${encodeURIComponent(value)}`, { signal });
      const payload = await response.json() as SearchPayload;
      if (!response.ok) throw new Error(payload.error ?? "Busca Steam indisponível.");
      if (sequence !== requestSequence.current) return;
      const games = payload.games ?? [];
      if (payload.kind === "preview" && games[0] && isPreview(games[0])) {
        setPreview(games[0]);
        setMatches([]);
        setActiveIndex(-1);
      } else {
        setPreview(null);
        setMatches(games.filter((game): game is SteamSearchMatch => !isPreview(game)));
        setActiveIndex(games.length ? 0 : -1);
        if (!games.length) setStatus("Nenhum jogo encontrado. Você pode incluí-lo manualmente.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (sequence !== requestSequence.current) return;
      setMatches([]);
      setPreview(null);
      setStatus(error instanceof Error ? error.message : "Busca Steam indisponível.");
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    controller.current?.abort();
    const value = query.trim();
    if (value.length < 2) return;
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
    setLoading(false);
  }

  async function selectMatch(match: SteamSearchMatch) {
    controller.current?.abort();
    setQuery(match.name);
    setMatches([]);
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
    } else if (event.key === "Escape") {
      setMatches([]);
      setActiveIndex(-1);
    }
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => updateQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Terraria, 105600 ou link da Steam"
          className="pl-9 pr-10"
          role="combobox"
          aria-label="Buscar jogo na Steam"
          aria-autocomplete="list"
          aria-expanded={matches.length > 0}
          aria-controls={listboxId}
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
        />
        {loading ? <LoaderCircle className="absolute right-3 top-3.5 size-4 animate-spin text-primary" aria-label="Buscando" /> : null}
        {matches.length ? (
          <div id={listboxId} role="listbox" className="absolute inset-x-0 top-[calc(100%+.4rem)] z-20 max-h-64 overflow-auto rounded-xl border border-border bg-card p-1 shadow-2xl">
            {matches.map((match, index) => (
              <button
                id={`${listboxId}-${index}`}
                key={match.appid}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => void selectMatch(match)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${index === activeIndex ? "bg-accent" : "hover:bg-accent"}`}
              >
                {match.headerImage ? <Image src={match.headerImage} alt="" width={72} height={34} className="h-9 w-16 rounded object-cover" /> : <span className="grid h-9 w-16 place-items-center rounded bg-secondary"><PackageSearch className="size-4" /></span>}
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{match.name}</span><span className="text-xs text-muted-foreground">AppID {match.appid}</span></span>
                <Check className={`size-4 text-primary ${index === activeIndex ? "opacity-100" : "opacity-0"}`} />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {preview ? (
        <article className="overflow-hidden rounded-xl border border-border bg-secondary/40">
          {preview.headerImage ? <Image src={preview.headerImage} alt={`Capa de ${preview.name}`} width={920} height={430} className="aspect-[2.15/1] w-full object-cover" priority /> : null}
          <div className="space-y-4 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="listed-eyebrow text-primary">Prévia Steam</p><h3 className="mt-1 text-xl font-semibold">{preview.name}</h3><p className="mt-1 text-xs text-muted-foreground">AppID {preview.appid} · {preview.type}</p></div>
              <a href={preview.storeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Ver na Steam <ExternalLink className="size-3" /></a>
            </div>
            {preview.shortDescription ? <p className="text-sm leading-6 text-muted-foreground">{preview.shortDescription}</p> : null}
            <div className="flex flex-wrap gap-1.5">
              {[...new Set([...preview.platforms, ...preview.genres, ...preview.features])].slice(0, 14).map((item) => <Badge key={item}>{item}</Badge>)}
            </div>
            <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div><dt className="text-muted-foreground">Lançamento</dt><dd className="mt-1 font-semibold">{preview.comingSoon ? "Em breve" : preview.releaseDate ?? "Não informado"}</dd></div>
              <div><dt className="text-muted-foreground">Preço</dt><dd className="mt-1 font-semibold">{preview.isFree ? "Gratuito" : preview.price?.formatted ?? "Ver na Steam"}</dd></div>
              <div><dt className="text-muted-foreground">Desenvolvedor</dt><dd className="mt-1 truncate font-semibold">{preview.developers[0] ?? "Não informado"}</dd></div>
              <div><dt className="text-muted-foreground">Cache</dt><dd className="mt-1 font-semibold">{preview.cacheState === "fresh" ? "Atualizado" : preview.cacheState === "refreshed" ? "Atualizado agora" : "Disponível"}</dd></div>
            </dl>
            {preview.warning ? <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300"><AlertTriangle className="mt-.5 size-4 shrink-0" />{preview.warning}</p> : null}
            <Button type="button" onClick={() => void addGame()} className="w-full" disabled={adding}>
              {adding ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />} Confirmar inclusão
            </Button>
          </div>
        </article>
      ) : null}

      {status ? <div role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{status}<button type="button" onClick={onManualFallback} className="ml-1 font-semibold underline">Adicionar manualmente</button></div> : null}
      {!status && !preview ? <p aria-live="polite" className="text-xs leading-5 text-muted-foreground">Digite ao menos 2 caracteres. A busca usa o índice local; os detalhes só são consultados após a seleção.</p> : null}
    </div>
  );
}
