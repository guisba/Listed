"use client";

import Image from "next/image";
import { Check, ExternalLink, Heart, ImageOff, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OwnershipStatus, SessionGame } from "@/types/domain";
import { useI18n } from "@/i18n/client";

interface ListedGameCardProps {
  game: SessionGame;
  rank: number;
  onVote: (game: SessionGame) => Promise<boolean>;
  onOwnership: (game: SessionGame, status: OwnershipStatus) => Promise<boolean>;
  voteDisabled?: boolean;
}

export function ListedGameCard({ game, rank, onVote, onOwnership, voteDisabled }: ListedGameCardProps) {
  const { t } = useI18n();
  const [voted, setVoted] = useState(Boolean(game.has_voted));
  const [voteCount, setVoteCount] = useState(game.vote_count ?? 0);
  const [ownership, setOwnership] = useState<OwnershipStatus>(game.ownership_status ?? "unknown");
  const [votePending, setVotePending] = useState(false);
  const [ownershipPending, setOwnershipPending] = useState(false);

  async function toggleVote() {
    if (votePending) return;
    const next = !voted;
    setVoted(next); setVoteCount((count) => Math.max(0, count + (next ? 1 : -1))); setVotePending(true);
    const saved = await onVote({ ...game, has_voted: voted });
    setVotePending(false);
    if (!saved) { setVoted(!next); setVoteCount((count) => Math.max(0, count + (next ? -1 : 1))); }
  }

  async function changeOwnership(next: OwnershipStatus) {
    if (ownershipPending) return;
    const previous = ownership;
    setOwnership(next); setOwnershipPending(true);
    const saved = await onOwnership(game, next);
    setOwnershipPending(false);
    if (!saved) setOwnership(previous);
  }

  return (
    <article className="selection-rail listed-enter grid grid-cols-[5.5rem_1fr] gap-3 border-b border-border bg-card py-4 pl-4 pr-1 transition-colors hover:bg-secondary/30 sm:grid-cols-[2.5rem_7.5rem_1fr_auto] sm:items-center sm:gap-4 sm:pl-5" data-active={rank === 1 || voted}>
      <span className="hidden font-mono text-xs font-semibold text-muted-foreground sm:block">{String(rank).padStart(2, "0")}</span>
      <div className="relative aspect-[16/10] overflow-hidden rounded-md bg-secondary">
        {game.image_url ? <Image src={game.image_url} alt={t("game.coverAlt", { game: game.name })} fill sizes="120px" className="object-cover" /> : <div className="grid h-full place-items-center text-muted-foreground"><ImageOff className="size-5" /><span className="sr-only">{t("game.imageUnavailable")}</span></div>}
      </div>
      <div className="min-w-0 self-center">
        <div className="flex items-start gap-2">
          <h3 className="line-clamp-2 font-semibold leading-5">{game.name}</h3>
          {game.store_url ? <a href={game.store_url} target="_blank" rel="noreferrer" className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-foreground" aria-label={t("game.openStore", { game: game.name })}><ExternalLink className="size-3.5" /></a> : null}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{t("game.ownershipCount", { owners: game.owner_count ?? 0, members: game.member_count ?? "?" })}</p>
        <div className="mt-2 flex min-h-6 flex-wrap gap-1.5">{[...new Set([...game.features, ...game.platforms])].slice(0, 3).map((feature) => <Badge key={feature}>{feature}</Badge>)}</div>
      </div>
      <div className="col-span-2 grid grid-cols-[1fr_auto] items-center gap-2 sm:col-span-1 sm:grid-cols-1 sm:justify-items-end">
        <Button variant={voted ? "default" : "secondary"} onClick={toggleVote} aria-pressed={voted} className="min-w-28" disabled={votePending || voteDisabled}>
          {votePending ? <LoaderCircle className="size-4 animate-spin" /> : voted ? <Check className="size-4" /> : <Heart className="size-4" />}
          <span>{voted ? t("game.voted") : t("game.vote")}</span><strong className="tabular font-mono">{voteCount}</strong>
        </Button>
        <label className="relative">
          <span className="sr-only">{t("game.access", { game: game.name })}</span>
          <select aria-label={t("game.ownership", { game: game.name })} value={ownership} onChange={(event) => changeOwnership(event.target.value as OwnershipStatus)} disabled={ownershipPending} className="h-9 max-w-36 rounded-md border border-border bg-background px-2 text-xs font-medium outline-none focus:border-primary">
            <option value="unknown">{t("ownership.unknown")}</option><option value="owns">{t("ownership.owns")}</option><option value="does_not_own">{t("ownership.doesNotOwn")}</option><option value="other_platform">{t("ownership.otherPlatform")}</option><option value="subscription">{t("ownership.subscription")}</option><option value="free">{t("ownership.free")}</option>
          </select>
        </label>
      </div>
    </article>
  );
}
