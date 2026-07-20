"use client";

import Image from "next/image";
import { Check, ExternalLink, Gamepad2, HardDrive, Heart, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { OwnershipStatus, SessionGame } from "@/types/domain";

const ownershipLabels: Record<OwnershipStatus, string> = {
  owns: "Tenho",
  does_not_own: "Não tenho",
  other_platform: "Outra plataforma",
  unknown: "Não sei",
  subscription: "Assinatura",
  free: "Gratuito",
};

interface GameCardProps {
  game: SessionGame;
  onVote: (game: SessionGame) => void;
  onOwnership: (game: SessionGame, status: OwnershipStatus) => void;
}

export function GameCard({ game, onVote, onOwnership }: GameCardProps) {
  return (
    <Card className="group overflow-hidden transition hover:-translate-y-0.5 hover:border-primary/30">
      <div className="relative aspect-[16/7] overflow-hidden bg-gradient-to-br from-primary/25 via-secondary to-background">
        {game.image_url ? <Image src={game.image_url} alt={`Capa de ${game.name}`} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition duration-500 group-hover:scale-[1.03]" /> : <div className="grid h-full place-items-center"><Gamepad2 className="size-10 text-primary/60" /></div>}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card to-transparent" />
        <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/65 px-3 py-1.5 text-sm font-black text-white backdrop-blur"><Heart className="size-3.5" fill={game.has_voted ? "currentColor" : "none"} /> {game.vote_count ?? 0}</div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-lg font-bold">{game.name}</h3><p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="size-3.5" /> {game.owner_count ?? 0} pessoas têm acesso</p></div>{game.store_url ? <a href={game.store_url} target="_blank" rel="noreferrer" className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={`Abrir ${game.name} na loja`}><ExternalLink className="size-4" /></a> : null}</div>
        <div className="mt-3 flex min-h-7 flex-wrap gap-1.5">{game.features.slice(0, 3).map((feature) => <Badge key={feature}>{feature}</Badge>)}{game.platforms.map((platform) => <Badge key={platform} className="bg-transparent">{platform}</Badge>)}</div>
        <div className="mt-4 grid grid-cols-[1fr_auto] gap-2"><Button variant={game.has_voted ? "default" : "secondary"} onClick={() => onVote(game)}>{game.has_voted ? <Check className="size-4" /> : <Heart className="size-4" />}{game.has_voted ? "Votado" : "Votar"}</Button><select aria-label={`Propriedade de ${game.name}`} value={game.ownership_status ?? "unknown"} onChange={(event) => onOwnership(game, event.target.value as OwnershipStatus)} className="h-11 max-w-36 rounded-full border border-border bg-secondary px-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-ring"><option value="unknown">Não sei</option><option value="owns">Tenho</option><option value="does_not_own">Não tenho</option><option value="other_platform">Outra plataforma</option><option value="subscription">Assinatura</option><option value="free">Gratuito</option></select></div>
        {game.ownership_status && game.ownership_status !== "unknown" ? <p className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted-foreground"><HardDrive className="size-3" /> {ownershipLabels[game.ownership_status]}</p> : null}
      </div>
    </Card>
  );
}
