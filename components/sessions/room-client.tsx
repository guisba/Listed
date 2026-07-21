"use client";

import Link from "next/link";
import { Check, ChevronDown, Copy, Dices, Link2, Lock, LogOut, Radio, Search, Share2, SignalLow, SlidersHorizontal, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { ListedLogo } from "@/components/brand/listed-logo";
import { AddGameDialog } from "@/components/games/add-game-dialog";
import { ListedGameCard } from "@/components/games/game-card";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { canManageSession } from "@/features/sessions/permissions";
import { useRoomData } from "@/features/sessions/use-room-data";
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
    return games
      .filter((game) => (!query || game.name.toLocaleLowerCase("pt-BR").includes(query)) && (filter === "all" || (filter === "playable" ? (game.owner_count ?? 0) >= members.length : game.features.includes(filter))))
      .sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "recent" ? b.created_at.localeCompare(a.created_at) : (b.vote_count ?? 0) - (a.vote_count ?? 0));
  }, [filter, games, members.length, search, sort]);

  async function vote(game: SessionGame) {
    if (!session || !userId) return false;
    const supabase = getBrowserSupabase(); if (!supabase) return false;
    const result = game.has_voted
      ? await supabase.from("votes").delete().eq("session_game_id", game.id).eq("user_id", userId)
      : await supabase.from("votes").insert({ session_id: session.id, session_game_id: game.id, user_id: userId });
    if (result.error) { setToast("O voto não foi salvo. Tente novamente."); return false; }
    await reload(); return true;
  }

  async function markOwnership(game: SessionGame, status: OwnershipStatus) {
    if (!session || !userId) return false;
    const supabase = getBrowserSupabase(); if (!supabase) return false;
    const { error: mutationError } = await supabase.from("game_ownership").upsert({ session_id: session.id, session_game_id: game.id, user_id: userId, status }, { onConflict: "session_game_id,user_id" });
    if (mutationError) { setToast("O acesso ao jogo não foi atualizado."); return false; }
    await reload(); return true;
  }

  async function copyCode() { await navigator.clipboard.writeText(code); setToast("Código copiado"); }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: session?.title ?? "Listed", text: `Entre na lista no Listed com o código ${code}`, url });
      else { await navigator.clipboard.writeText(url); setToast("Link copiado"); }
    } catch { /* compartilhamento cancelado */ }
  }

  async function draw() {
    if (!session) return;
    setDrawing(true);
    const supabase = getBrowserSupabase();
    const { data, error: drawError } = supabase ? await supabase.rpc("draw_session_game", { target_session_id: session.id, weighted: session.decision_method === "weighted_random" }) : { data: null, error: new Error("Supabase não configurado") };
    setDrawing(false);
    if (drawError) return setToast("O sorteio falhou. Confira os jogos elegíveis.");
    const result = data as { game_id: string };
    setDrawResult(games.find((game) => game.id === result.game_id) ?? null);
  }

  async function updateStatus(status: "open" | "locked" | "closed") {
    if (!session) return;
    const supabase = getBrowserSupabase(); if (!supabase) return;
    const { error: statusError } = await supabase.from("sessions").update({ status }).eq("id", session.id);
    if (statusError) setToast("Você não tem permissão para essa ação."); else await reload();
  }

  if (loading) return <main className="grid min-h-screen place-items-center"><div className="w-full max-w-xs"><div className="h-1 overflow-hidden bg-secondary"><span className="block h-full w-1/2 animate-pulse bg-primary" /></div><p className="mt-4 text-center text-sm text-muted-foreground">Abrindo a lista…</p></div></main>;
  if (error || !session || !userId) return <main className="grid min-h-screen place-items-center px-4"><div className="max-w-md text-center"><SignalLow className="mx-auto size-9 text-destructive" /><h1 className="mt-5 text-2xl font-semibold">Esta lista não abriu.</h1><p className="mt-3 leading-6 text-muted-foreground">{error ?? "O convite pode ser inválido ou ter expirado."}</p><Button asChild className="mt-7"><Link href="/">Voltar ao início</Link></Button></div></main>;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/92 backdrop-blur-md">
        <div className="compact-320 mx-auto flex h-16 max-w-[var(--content-max)] items-center justify-between px-4 sm:px-6">
          <ListedLogo compact />
          <div className="flex items-center gap-1"><Button variant="ghost" size="icon" onClick={share} aria-label="Compartilhar lista"><Share2 className="size-4" /></Button><ThemeSwitcher /><Button asChild variant="ghost" size="icon"><Link href="/" aria-label="Sair da lista"><LogOut className="size-4" /></Link></Button></div>
        </div>
      </header>

      <main className="compact-320 mx-auto max-w-[var(--content-max)] px-4 py-6 sm:px-6 sm:py-9">
        <section className="grid gap-5 border-b border-border pb-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 font-medium ${session.status === "open" ? "border-success/30 text-success" : "border-border text-muted-foreground"}`}><Radio className="size-3.5" /> {session.status === "open" ? "Lista aberta" : session.status}</span>
              <button onClick={copyCode} className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 font-mono font-semibold tracking-wider transition-colors hover:border-primary">{code}<Copy className="size-3" /></button>
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-[-.04em] sm:text-4xl">{session.title}</h1>
            <p className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground"><span>{members.length} participantes</span><span className="text-success">{onlineUserIds.length || 1} online</span><span>{games.length} jogos</span></p>
          </div>
          <AddGameDialog sessionId={session.id} userId={userId} onAdded={reload} />
        </section>

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="min-w-0">
            <section aria-label="Filtros da lista" className="border-b border-border pb-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1"><Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nesta lista" className="pl-10" /></div>
                <label className="relative shrink-0"><span className="sr-only">Ordenar jogos</span><SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><select value={sort} onChange={(event) => setSort(event.target.value)} className="h-12 appearance-none rounded-lg border border-input bg-background pl-9 pr-9 text-xs font-semibold outline-none focus:border-primary"><option value="votes">Mais votados</option><option value="name">Nome</option><option value="recent">Recentes</option></select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3 -translate-y-1/2" /></label>
              </div>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{featureFilters.map(([value, label]) => <button key={value} onClick={() => setFilter(value)} aria-pressed={filter === value} className={`h-9 shrink-0 rounded-md border px-3 text-xs font-medium transition-colors ${filter === value ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}>{label}</button>)}</div>
            </section>

            {visibleGames.length ? <section className="mt-2 border-t border-border" aria-label="Jogos da lista">{visibleGames.map((game, index) => <ListedGameCard key={`${game.id}:${game.has_voted}:${game.vote_count}:${game.ownership_status}`} game={{ ...game, member_count: members.length }} rank={index + 1} onVote={vote} onOwnership={markOwnership} />)}</section> : <section className="my-16 border-y border-border py-12 text-center"><h2 className="text-xl font-semibold">{games.length ? "Nenhum jogo corresponde aos filtros." : "A lista começa com o primeiro jogo."}</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{games.length ? "Remova um filtro ou tente outro nome." : "Adicione pela Steam ou inclua manualmente qualquer jogo e plataforma."}</p></section>}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-22 lg:self-start">
            <section className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between"><p className="listed-eyebrow">Participantes</p><Users className="size-4 text-muted-foreground" /></div>
              <div className="mt-4 space-y-2">{members.map((member) => <div key={member.id} className="flex items-center gap-3 py-1.5"><span className={`grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold ${onlineUserIds.includes(member.user_id) || member.user_id === userId ? "ring-2 ring-success/45" : ""}`}>{member.display_name.slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1 truncate text-sm font-medium">{member.display_name}</span>{member.role !== "member" ? <span className="text-[10px] text-primary">{member.role}</span> : null}</div>)}</div>
              <button onClick={share} className="mt-4 flex w-full items-center justify-center gap-2 border-t border-border pt-4 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"><Link2 className="size-3.5" /> Convidar mais alguém</button>
            </section>

            <section className="rounded-xl border border-border bg-card p-4">
              <p className="listed-eyebrow">Decisão</p>
              <p className="mt-3 text-sm font-semibold">{session.decision_method === "weighted_random" ? "Sorteio ponderado" : session.decision_method === "random" ? "Sorteio simples" : "Votação aberta"}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{games.length ? `${games.length} jogos elegíveis nesta lista.` : "Adicione jogos para iniciar a decisão."}</p>
              <Button onClick={draw} disabled={drawing || games.length === 0} className="mt-4 w-full" variant="secondary"><Dices className={`size-4 ${drawing ? "animate-spin" : ""}`} /> {drawing ? "Sorteando…" : "Sortear agora"}</Button>
            </section>

            {canManage ? <section className="rounded-xl border border-border p-4"><p className="listed-eyebrow">Administração</p><div className="mt-3 grid gap-2"><Button variant="ghost" onClick={() => updateStatus(session.status === "locked" ? "open" : "locked")} className="justify-start"><Lock className="size-4" /> {session.status === "locked" ? "Reabrir lista" : "Bloquear entradas"}</Button><Button variant="ghost" onClick={() => updateStatus("closed")} className="justify-start text-destructive">Encerrar lista</Button></div></section> : null}
          </aside>
        </div>
      </main>

      {toast ? <button onClick={() => setToast(null)} className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-foreground px-4 py-3 text-sm font-medium text-background shadow-xl"><Check className="size-4" />{toast}</button> : null}
      <Dialog open={Boolean(drawResult)} onOpenChange={(open) => !open && setDrawResult(null)}><DialogContent className="text-center"><p className="listed-eyebrow text-primary">Resultado registrado</p><DialogTitle className="mt-4 text-3xl font-semibold tracking-[-.04em]">{drawResult?.name}</DialogTitle><DialogDescription className="mt-2 text-muted-foreground">A escolha ficou salva no histórico da lista.</DialogDescription><Button className="mt-6 w-full" onClick={() => setDrawResult(null)}>Vamos jogar</Button></DialogContent></Dialog>
    </div>
  );
}
