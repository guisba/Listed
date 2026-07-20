"use client";

import { Gamepad2, LoaderCircle, PackageSearch, Plus, Search } from "lucide-react";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { normalizeName } from "@/lib/utils";
import { getBrowserSupabase } from "@/lib/supabase/browser";

interface AddGameDialogProps { sessionId: string; userId: string; onAdded: () => void; }

export function AddGameDialog({ sessionId, userId, onAdded }: AddGameDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"manual" | "steam">("manual");
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("PC");
  const [steamQuery, setSteamQuery] = useState("");
  const [steamResult, setSteamResult] = useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function addManual(event: FormEvent) {
    event.preventDefault(); setLoading(true); setStatus(null);
    const supabase = getBrowserSupabase();
    if (!supabase) { setLoading(false); return setStatus("Supabase não configurado."); }
    const { error } = await supabase.from("session_games").insert({ session_id: sessionId, source: "manual", name: name.trim(), normalized_name: normalizeName(name), platforms: [platform], features: [], added_by: userId });
    setLoading(false);
    if (error) return setStatus(error.code === "23505" ? "Esse jogo já está na sessão." : error.message);
    setName(""); setOpen(false); onAdded();
  }

  async function searchSteam(event: FormEvent) {
    event.preventDefault(); setLoading(true); setStatus(null); setSteamResult(null);
    try {
      const response = await fetch(`/api/steam/search?q=${encodeURIComponent(steamQuery)}`);
      const payload = (await response.json()) as { error?: string; games?: Array<Record<string, unknown>> };
      if (!response.ok) throw new Error(payload.error ?? "Busca indisponível.");
      const first = payload.games?.[0];
      if (!first) throw new Error("Nenhum jogo encontrado no catálogo local.");
      setSteamResult(first);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Busca indisponível."); }
    finally { setLoading(false); }
  }

  async function addSteam() {
    if (!steamResult) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setLoading(true); setStatus(null);
    const appid = Number(steamResult.steam_appid ?? steamResult.appid);
    const gameName = String(steamResult.name ?? "Jogo Steam");
    const { error } = await supabase.from("session_games").insert({
      session_id: sessionId, source: "steam", steam_appid: appid,
      catalog_game_id: typeof steamResult.id === "string" ? steamResult.id : null,
      name: gameName, normalized_name: normalizeName(gameName),
      image_url: steamResult.header_image ?? steamResult.headerImage ?? null,
      store_url: steamResult.store_url ?? steamResult.storeUrl ?? `https://store.steampowered.com/app/${appid}/`,
      platforms: steamResult.platforms ?? [], features: steamResult.features ?? [], added_by: userId,
    });
    setLoading(false);
    if (error) return setStatus(error.code === "23505" ? "Esse jogo já está na sessão." : error.message);
    setOpen(false); setSteamResult(null); setSteamQuery(""); onAdded();
  }

  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus className="size-4" /> Adicionar jogo</Button></DialogTrigger><DialogContent><p className="listed-eyebrow">Novo item</p><DialogTitle className="mt-2 text-2xl font-semibold tracking-[-.03em]">Adicionar à lista</DialogTitle><DialogDescription className="mt-2 text-sm text-muted-foreground">Busque no catálogo Steam ou inclua qualquer jogo manualmente.</DialogDescription><div className="mt-5 grid grid-cols-2 gap-1 rounded-lg border border-border bg-secondary p-1"><button type="button" onClick={() => setMode("manual")} className={`flex h-10 items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors ${mode === "manual" ? "bg-card text-foreground" : "text-muted-foreground"}`}><Gamepad2 className="size-4" /> Manual</button><button type="button" onClick={() => setMode("steam")} className={`flex h-10 items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors ${mode === "steam" ? "bg-card text-foreground" : "text-muted-foreground"}`}><PackageSearch className="size-4" /> Steam</button></div>{mode === "manual" ? <form onSubmit={addManual} className="mt-5 space-y-4"><label className="block space-y-2"><span className="text-sm font-semibold">Nome do jogo</span><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Minecraft, Valorant, jogo de tabuleiro…" required minLength={2} /></label><label className="block space-y-2"><span className="text-sm font-semibold">Plataforma</span><Input value={platform} onChange={(event) => setPlatform(event.target.value)} placeholder="PC, Xbox, PlayStation…" /></label><Button type="submit" className="w-full" disabled={loading || name.trim().length < 2}>{loading ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />} Adicionar à lista</Button></form> : <div className="mt-5"><form onSubmit={searchSteam} className="flex gap-2"><Input value={steamQuery} onChange={(event) => setSteamQuery(event.target.value)} placeholder="Nome, AppID ou URL da Steam" required /><Button type="submit" size="icon" aria-label="Buscar" disabled={loading}>{loading ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4" />}</Button></form>{steamResult ? <div className="selection-rail mt-4 border-y border-border py-4 pl-4" data-active="true"><p className="listed-eyebrow text-primary">Prévia Steam</p><p className="mt-1 font-semibold">{String(steamResult.name)}</p><p className="mt-1 text-xs text-muted-foreground">AppID {String(steamResult.steam_appid ?? steamResult.appid)} · confira antes de incluir.</p><Button onClick={addSteam} className="mt-4 w-full" disabled={loading}><Plus className="size-4" /> Confirmar inclusão</Button></div> : null}</div>}{status ? <p role="alert" className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{status}</p> : null}</DialogContent></Dialog>;
}
