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
import { useI18n } from "@/i18n/client";

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

interface EnrichmentPayload {
  images?: Array<Pick<SteamSearchMatch, "appid" | "capsuleImageUrl" | "imageStatus">>;
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
  const { t } = useI18n();
  return (
    <div aria-label={t("steam.searchingGames")} className="space-y-2 p-3">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex h-[76px] animate-pulse gap-3 rounded-xl border border-border/60 p-2.5">
          <div className="h-12 w-[92px] shrink-0 rounded-lg bg-secondary" />
          <div className="min-w-0 flex-1 space-y-2 py-1"><div className="h-3 w-4/5 rounded bg-secondary" /><div className="h-2.5 w-2/5 rounded bg-secondary" /></div>
        </div>
      ))}
    </div>
  );
}

function ResultImage({ match }: { match: SteamSearchMatch }) {
  const { t } = useI18n();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const imageUrl = failed ? null : match.capsuleImageUrl;
  const waiting = !imageUrl && (match.imageStatus === "unknown" || match.imageStatus === "stale");

  if (waiting) {
    return <span aria-hidden="true" className="h-[39px] w-[104px] shrink-0 animate-pulse rounded-lg bg-secondary motion-reduce:animate-none sm:h-[45px] sm:w-[120px]" />;
  }
  if (!imageUrl) {
    return <span aria-hidden="true" className="grid h-[39px] w-[104px] shrink-0 place-items-center rounded-lg bg-secondary sm:h-[45px] sm:w-[120px]"><PackageSearch className="size-5 text-muted-foreground" /></span>;
  }
  return (
    <span className="relative h-[39px] w-[104px] shrink-0 overflow-hidden rounded-lg bg-secondary sm:h-[45px] sm:w-[120px]">
      {!loaded ? <span aria-hidden="true" className="absolute inset-0 animate-pulse bg-secondary motion-reduce:animate-none" /> : null}
      <Image
        src={imageUrl}
        alt={t("steam.imageAlt", { game: match.name })}
        fill
        sizes="(max-width: 639px) 104px, 120px"
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`object-cover motion-safe:transition-opacity motion-safe:duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </span>
  );
}

function CatalogNotice({ catalog }: { catalog: CatalogMetadata | null }) {
  const { t } = useI18n();
  if (!catalog || catalog.status === "complete") return null;
  const message = catalog.status === "syncing" || catalog.status === "partial"
    ? t("steam.catalog.syncing")
    : catalog.status === "empty"
      ? t("steam.catalog.empty")
      : catalog.status === "failed"
        ? t("steam.catalog.failed")
        : t("steam.catalog.unknown");
  return <p className="border-b border-border bg-amber-500/10 px-4 py-2.5 text-xs leading-5 text-amber-800 dark:text-amber-200">{message}</p>;
}

function FeatureSummary({ preview }: { preview: SteamGamePreview }) {
  const { t } = useI18n();
  const labels: Record<string, string> = {
    singleplayer: t("steam.singleplayer"),
    "coop-local": t("steam.coopLocal"),
    "coop-online": t("steam.coopOnline"),
    multiplayer: t("steam.multiplayer"),
    "controller-support": t("steam.controller"),
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
  const { t } = useI18n();
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
  const [visibleAppids, setVisibleAppids] = useState<number[]>([]);
  const requestSequence = useRef(0);
  const enrichmentSequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const enrichmentController = useRef<AbortController | null>(null);
  const resultsViewport = useRef<HTMLDivElement | null>(null);
  const skipNextDebouncedSearch = useRef(false);

  const requestGames = useCallback(async (value: string, signal?: AbortSignal, offset = 0) => {
    const sequence = ++requestSequence.current;
    if (offset > 0) setLoadingMore(true);
    else setLoading(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/steam/search?q=${encodeURIComponent(value)}&limit=12&offset=${offset}`, { signal });
      const payload = await response.json() as SearchPayload;
      if (!response.ok) throw new Error("search_failed");
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
        if (!nextMatches.length && offset === 0) setStatus(t("steam.noResults"));
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (sequence !== requestSequence.current) return;
      if (offset === 0) {
        setMatches([]);
        setPreview(null);
      }
      setStatus(t("steam.error"));
    } finally {
      if (sequence === requestSequence.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [t]);

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

  useEffect(() => {
    const root = resultsViewport.current;
    if (!root || !matches.length) {
      return;
    }
    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-steam-appid]"));
    if (typeof IntersectionObserver === "undefined") {
      const timer = window.setTimeout(() => setVisibleAppids(matches.slice(0, 12).map((match) => match.appid)), 0);
      return () => window.clearTimeout(timer);
    }
    const visible = new Set<number>();
    const publish = () => {
      const next = matches.map((match) => match.appid).filter((appid) => visible.has(appid));
      setVisibleAppids((current) => current.length === next.length && current.every((appid, index) => appid === next[index]) ? current : next);
    };
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const appid = Number((entry.target as HTMLElement).dataset.steamAppid);
        if (entry.isIntersecting) visible.add(appid);
        else visible.delete(appid);
      }
      publish();
    }, { root, threshold: 0.2 });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [matches]);

  useEffect(() => {
    enrichmentController.current?.abort();
    const appids = matches
      .filter((match) => visibleAppids.includes(match.appid) && !match.capsuleImageUrl && (match.imageStatus === "unknown" || match.imageStatus === "stale"))
      .slice(0, 12)
      .map((match) => match.appid);
    if (!appids.length) return;

    const sequence = ++enrichmentSequence.current;
    const nextController = new AbortController();
    enrichmentController.current = nextController;
    void (async () => {
      try {
        const response = await fetch("/api/steam/search/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appids }),
          signal: nextController.signal,
        });
        if (!response.ok) return;
        const payload = await response.json() as EnrichmentPayload;
        if (sequence !== enrichmentSequence.current || nextController.signal.aborted) return;
        const byAppid = new Map((payload.images ?? []).map((image) => [image.appid, image]));
        setMatches((current) => current.map((match) => {
          const image = byAppid.get(match.appid);
          return image ? { ...match, ...image } : match;
        }));
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          // Image enrichment is best-effort and must never replace textual search results.
        }
      }
    })();
    return () => nextController.abort();
  }, [matches, visibleAppids]);

  function updateQuery(value: string) {
    setQuery(value);
    enrichmentController.current?.abort();
    enrichmentSequence.current += 1;
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
      if (!response.ok) throw new Error("add_failed");
      onAdded();
    } catch {
      setStatus(t("steam.addError"));
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
    <section className={`${preview ? "hidden md:flex" : "flex"} min-h-0 flex-col border-border md:border-r`} aria-label={t("steam.searchResults")}>
      <div className="shrink-0 border-b border-border p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("steam.searchPlaceholder")}
            className="pl-9 pr-10"
            role="combobox"
            aria-label={t("steam.searchLabel")}
            aria-autocomplete="list"
            aria-expanded={matches.length > 0}
            aria-controls={listboxId}
            aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
          />
          {loading ? <LoaderCircle className="absolute right-3 top-3.5 size-4 animate-spin text-primary" aria-label={t("steam.searching")} /> : null}
        </div>
      </div>
      <CatalogNotice catalog={catalog} />
      <div ref={resultsViewport} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading && !matches.length ? <ResultSkeletons /> : matches.length ? (
          <div id={listboxId} role="listbox" className="space-y-2 p-3">
            {matches.map((match, index) => (
              <button
                id={`${listboxId}-${index}`}
                key={match.appid}
                data-steam-appid={match.appid}
                type="button"
                role="option"
                aria-selected={preview?.appid === match.appid || index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => void selectMatch(match)}
                className={`flex min-h-[76px] w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-[background-color,border-color,transform] hover:-translate-y-px ${preview?.appid === match.appid || index === activeIndex ? "border-primary/50 bg-primary/5" : "border-border hover:bg-accent"}`}
              >
                <ResultImage match={match} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-5"><HighlightedName name={match.name} query={query} /></span>
                  <span className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                    <span>AppID {match.appid}</span>
                    <span>{match.releaseDate?.match(/\d{4}/)?.[0] ?? (match.type === "unknown" ? t("steam.typePending") : t("common.game"))}</span>
                    {match.platforms.slice(0, 2).map((platform) => <span key={platform}>{platform}</span>)}
                  </span>
                </span>
                <Check className={`size-4 shrink-0 text-primary ${preview?.appid === match.appid || index === activeIndex ? "opacity-100" : "opacity-0"}`} />
              </button>
            ))}
            {hasMore ? <Button type="button" variant="secondary" className="w-full" disabled={loadingMore} onClick={() => void requestGames(query, undefined, matches.length)}>{loadingMore ? <LoaderCircle className="size-4 animate-spin" /> : null} {t("steam.loadMore")}</Button> : null}
          </div>
        ) : (
          <div className="grid min-h-56 place-items-center px-6 text-center">
            <div><PackageSearch className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 text-sm font-semibold">{status ?? t("steam.minChars")}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{t("steam.searchHelp")}</p></div>
          </div>
        )}
      </div>
    </section>
  );

  const previewPanel = (
    <section className={`${preview ? "flex" : "hidden md:flex"} min-h-0 flex-col bg-secondary/20`} aria-label={t("steam.previewLabel")}>
      {preview ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <button type="button" onClick={() => setPreview(null)} className="m-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground md:hidden"><ArrowLeft className="size-4" /> {t("steam.backResults")}</button>
            <div className="px-4 pb-5 pt-0 md:p-5">
              <article className="overflow-hidden rounded-2xl border border-border bg-card">
                {preview.headerImage ? <Image src={preview.headerImage} alt={t("steam.heroAlt", { game: preview.name })} width={920} height={430} className="aspect-[2.15/1] w-full bg-secondary object-cover" priority sizes="(min-width: 768px) 58vw, 100vw" /> : <div className="grid aspect-[2.15/1] place-items-center bg-secondary"><PackageSearch className="size-10 text-muted-foreground" /></div>}
                <div className="space-y-5 p-5">
                  <div>
                    <p className="listed-eyebrow text-primary">{t("steam.preview")}</p>
                    <h3 className="mt-1 text-2xl font-semibold tracking-[-.03em]">{preview.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">AppID {preview.appid} · {t("common.game")}</p>
                  </div>
                  {preview.shortDescription ? <p className="text-sm leading-6 text-muted-foreground">{preview.shortDescription}</p> : null}
                  {preview.fullDescription && preview.fullDescription !== preview.shortDescription ? <details className="rounded-xl border border-border p-3 text-sm text-muted-foreground"><summary className="cursor-pointer font-semibold text-foreground">{t("steam.fullDescription")}</summary><p className="mt-3 leading-6">{preview.fullDescription}</p></details> : null}
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-xl bg-secondary/70 p-3"><dt className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="size-3.5" /> {t("steam.release")}</dt><dd className="mt-1.5 font-semibold">{preview.comingSoon ? t("steam.comingSoon") : preview.releaseDate ?? t("common.notInformed")}</dd></div>
                    <div className="rounded-xl bg-secondary/70 p-3"><dt className="text-xs text-muted-foreground">{t("steam.price")}</dt><dd className="mt-1.5 font-semibold">{preview.isFree ? t("ownership.free") : preview.price?.formatted ?? t("steam.checkPrice")}</dd></div>
                    <div className="rounded-xl bg-secondary/70 p-3"><dt className="text-xs text-muted-foreground">{t("steam.developer")}</dt><dd className="mt-1.5 font-semibold">{preview.developers.join(", ") || t("common.notInformed")}</dd></div>
                    <div className="rounded-xl bg-secondary/70 p-3"><dt className="text-xs text-muted-foreground">{t("steam.publisher")}</dt><dd className="mt-1.5 font-semibold">{preview.publishers.join(", ") || t("common.notInformed")}</dd></div>
                  </dl>
                  <FeatureSummary preview={preview} />
                  {[{ label: t("steam.platforms"), values: preview.platforms }, { label: t("steam.genres"), values: preview.genres }, { label: t("steam.categories"), values: preview.categories }].map((section) => section.values.length ? (
                    <Fragment key={section.label}><div className="h-px bg-border" /><div><h4 className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{section.label}</h4><div className="mt-2 flex flex-wrap gap-1.5">{section.values.slice(0, 18).map((item) => <Badge key={item}>{item}</Badge>)}</div></div></Fragment>
                  ) : null)}
                  {preview.warning ? <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300"><AlertTriangle className="mt-.5 size-4 shrink-0" />{t("steam.unavailable")}</p> : null}
                </div>
              </article>
            </div>
          </div>
          <footer className="grid shrink-0 grid-cols-1 gap-2 border-t border-border bg-card p-4 sm:grid-cols-3">
            <Button type="button" variant="ghost" onClick={onCancel}>{t("common.cancel")}</Button>
            <Button asChild variant="secondary"><a href={preview.storeUrl} target="_blank" rel="noreferrer">{t("steam.open")} <ExternalLink className="size-4" /></a></Button>
            <Button type="button" onClick={() => void addGame()} disabled={adding}>{adding ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />} {t("add.title")}</Button>
          </footer>
        </>
      ) : (
        <div className="grid h-full place-items-center p-8 text-center"><div><PackageSearch className="mx-auto size-10 text-muted-foreground" /><h3 className="mt-4 font-semibold">{t("steam.select")}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{t("steam.selectDescription")}</p></div></div>
      )}
    </section>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {searchPanel}
        {previewPanel}
      </div>
      {status && matches.length > 0 ? <div role="alert" className="shrink-0 border-t border-border bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{status}<button type="button" onClick={onManualFallback} className="ml-1 font-semibold underline">{t("add.manualAction")}</button></div> : null}
      {!preview ? <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-card p-4 md:hidden"><Button type="button" variant="ghost" onClick={onCancel}>{t("common.cancel")}</Button><Button type="button" variant="secondary" onClick={onManualFallback}>{t("add.manualAction")}</Button></footer> : null}
    </div>
  );
}
