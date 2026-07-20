"use client";

import Link from "next/link";
import { Check, ChevronDown, Copy, Dices, Gamepad2, Link2, Lock, LogOut, Search, Share2, Signal, SignalLow, SlidersHorizontal, Sparkles, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { AddGameDialog } from "@/components/games/add-game-dialog";
import { GameCard } from "@/components/games/game-card";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useRoomData } from "@/features/sessions/use-room-data";
import { canManageSession } from "@/features/sessions/permissions";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import type { OwnershipStatus, SessionGame } from "@/types/domain";

const featureFilters = [["all", "Todos"], ["coop-online", "Coop online"], ["coop-local", "Coop local"], ["free-to-play", "Gratuitos"], ["playable", "Todos têm"]] as const;

export function RoomClient({ code }: { code: string }) {
  const { session, members, games, userId, onlineUserIds, loading, error, reload } = useRoomData(code);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("votes");
  const [toast, setToast] = useState<string | null>(null);
  const [drawResult, setDrawResult] = useState<SessionGame | null>(null);
  const [drawing, setDrawing] = useState(false);

  const currentMember = members.find((member) => member.user_id === userId);
  const canManage = currentMember ? canManageSession(currentMember.role) : false;
  const visibleGames = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return games.filter((game) => (!query || game.name.toLocaleLowerCase("pt-BR").includes(query)) && (filter === "all" || (filter === "playable" ? (game.owner_count ?? 0) >= members.length : game.features.includes(filter)))).sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "recent" ? b.created_at.localeCompare(a.created_at) : (b.vote_count ?? 0) - (a.vote_count ?? 0));
  }, [filter, games, members.length, search, sort]);

  async function vote(game: SessionGame) {
    if (!session || !userId) return;
    const supabase = getBrowserSupabase(); if (!supabase) return;
    const result = game.has_voted
      ? await supabase.from("votes").delete().eq("session_game_id", game.id).eq("user_id", userId)
      : await supabase.from("votes").insert({ session_id: session.id, session_game_id: game.id, user_id: userId });
    if (result.error) setToast("Seu voto não foi salvo. Tente novamente."); else await reload();
  }

  async function markOwnership(game: SessionGame, status: OwnershipStatus) {
    if (!session || !userId) return;
    const supabase = getBrowserSupabase(); if (!supabase) return;
    const { error: mutationError } = await supabase.from("game_ownership").upsert({ session_id: session.id, session_game_id: game.id, user_id: userId, status }, { onConflict: "session_game_id,user_id" });
    if (mutationError) setToast("Não foi possível atualizar sua propriedade."); else await reload();
  }

  async function share() {
    const url = window.location.href;
    try { if (navigator.share) await navigator.share({ title: session?.title ?? "JogaJunto", text: `Entre na nossa sessão com o código ${code}`, url }); else { await navigator.clipboard.writeText(url); setToast("Link copiado!"); } } catch { /* user cancelled */ }
  }

  async function draw() {
    if (!session) return;
    setDrawing(true);
    const supabase = getBrowserSupabase();
    const { data, error: drawError } = supabase ? await supabase.rpc("draw_session_game", { target_session_id: session.id, weighted: session.decision_method === "weighted_random" }) : { data: null, error: new Error("Supabase não configurado") };
    setDrawing(false);
    if (drawError) return setToast("O sorteio falhou. Confira se existem jogos elegíveis.");
    const result = data as { game_id: string };
    setDrawResult(games.find((game) => game.id === result.game_id) ?? null);
  }

  async function updateStatus(status: "open" | "locked" | "closed") {
    if (!session) return;
    const supabase = getBrowserSupabase(); if (!supabase) return;
    const { error: statusError } = await supabase.from("sessions").update({ status }).eq("id", session.id);
    if (statusError) setToast("Você não tem permissão para essa ação."); else await reload();
  }

  if (loading) return <main className="grid min-h-screen place-items-center"><div className="text-center"><Sparkles className="mx-auto size-7 animate-pulse text-primary" /><p className="mt-3 text-sm text-muted-foreground">Carregando a sessão…</p></div></main>;
  if (error || !session || !userId) return <main className="grid min-h-screen place-items-center px-4"><div className="max-w-md text-center"><SignalLow className="mx-auto size-10 text-destructive" /><h1 className="mt-5 text-2xl font-black">Não conseguimos abrir esta sala.</h1><p className="mt-3 text-muted-foreground">{error ?? "O convite pode ser inválido ou ter expirado."}</p><Button asChild className="mt-7"><Link href="/">Voltar ao início</Link></Button></div></main>;

  return <div className="min-h-screen bg-background"><header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl"><div className="mx-auto flex h-17 max-w-7xl items-center justify-between px-4 sm:px-6"><Link href="/" className="flex items-center gap-2 font-black"><span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Gamepad2 className="size-5" /></span><span className="hidden sm:inline">JogaJunto</span></Link><div className="flex items-center gap-1"><Button variant="ghost" size="icon" onClick={share} aria-label="Compartilhar sessão"><Share2 className="size-4" /></Button><ThemeSwitcher /><Button asChild variant="ghost" size="icon"><Link href="/" aria-label="Sair da sala"><LogOut className="size-4" /></Link></Button></div></div></header><main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10"><section className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><Badge className={session.status === "open" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : ""}><Signal className="mr-1 size-3" /> {session.status === "open" ? "Sessão aberta" : session.status}</Badge><button onClick={() => navigator.clipboard.writeText(code).then(() => setToast("Código copiado!"))} className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1 font-mono text-xs font-bold tracking-wider">{code}<Copy className="size-3" /></button></div><h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">{session.title}</h1><div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground"><span className="flex items-center gap-2"><Users className="size-4" /> {members.length} participantes</span><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-emerald-400" /> {onlineUserIds.length || 1} online</span><span>{games.length} jogos</span></div></div><div className="flex flex-wrap gap-2">{canManage ? <Button variant="secondary" onClick={() => updateStatus(session.status === "locked" ? "open" : "locked")}><Lock className="size-4" /> {session.status === "locked" ? "Desbloquear" : "Bloquear"}</Button> : null}<Button variant="secondary" onClick={draw} disabled={drawing || games.length === 0}><Dices className={`size-4 ${drawing ? "animate-spin" : ""}`} /> Sortear</Button><AddGameDialog sessionId={session.id} userId={userId} onAdded={reload} /></div></section><section className="mt-8 rounded-3xl border border-border bg-card p-3 sm:p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="relative flex-1"><Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nesta lista" className="pl-11" /></div><div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">{featureFilters.map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className={`h-10 shrink-0 rounded-full border px-4 text-xs font-semibold ${filter === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary text-muted-foreground"}`}>{label}</button>)}</div><label className="relative"><span className="sr-only">Ordenar jogos</span><SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><select value={sort} onChange={(event) => setSort(event.target.value)} className="h-10 appearance-none rounded-full border border-border bg-secondary pl-9 pr-9 text-xs font-semibold outline-none"><option value="votes">Mais votados</option><option value="name">Nome</option><option value="recent">Recentes</option></select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3 -translate-y-1/2" /></label></div></section>{visibleGames.length ? <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visibleGames.map((game) => <GameCard key={game.id} game={game} onVote={vote} onOwnership={markOwnership} />)}</section> : <section className="mt-16 text-center"><div className="mx-auto grid size-16 place-items-center rounded-3xl bg-secondary text-primary"><Gamepad2 className="size-7" /></div><h2 className="mt-5 text-xl font-black">{games.length ? "Nenhum jogo bate com os filtros" : "A lista ainda está vazia"}</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{games.length ? "Tente remover um filtro ou buscar outro nome." : "Adicione o primeiro jogo — pode ser da Steam ou de qualquer outra plataforma."}</p></section>}<aside className="mt-10 rounded-3xl border border-border bg-secondary/25 p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Na sala</p><div className="mt-3 flex flex-wrap gap-2">{members.map((member) => <span key={member.id} className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-xs font-semibold"><span className={`size-2 rounded-full ${onlineUserIds.includes(member.user_id) || member.user_id === userId ? "bg-emerald-400" : "bg-muted"}`} />{member.display_name}{member.role !== "member" ? <span className="text-primary">· {member.role}</span> : null}</span>)}</div></div><Link2 className="size-5 text-muted-foreground" /></div></aside></main>{toast ? <button onClick={() => setToast(null)} className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background shadow-2xl"><Check className="size-4" />{toast}</button> : null}<Dialog open={Boolean(drawResult)} onOpenChange={(open) => !open && setDrawResult(null)}><DialogContent className="text-center"><div className="mx-auto grid size-16 place-items-center rounded-3xl bg-primary/15 text-primary"><Dices className="size-8" /></div><DialogTitle className="mt-5 text-2xl font-black">Deu {drawResult?.name}!</DialogTitle><DialogDescription className="mt-2 text-muted-foreground">O resultado foi registrado no histórico desta sessão.</DialogDescription><Button className="mt-6 w-full" onClick={() => setDrawResult(null)}>Fechado, vamos jogar</Button></DialogContent></Dialog></div>;
}
