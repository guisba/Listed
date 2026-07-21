"use client";

import { Gamepad2, LoaderCircle, PackageSearch, Plus } from "lucide-react";
import { FormEvent, useState } from "react";
import { SteamGamePicker } from "@/components/games/steam-game-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { normalizeName } from "@/lib/utils";

interface AddGameDialogProps { sessionId: string; userId: string; onAdded: () => void }

export function AddGameDialog({ sessionId, userId, onAdded }: AddGameDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"steam" | "manual">("steam");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [manual, setManual] = useState({ name: "", platform: "PC", link: "", description: "", image: "", tags: "", gameMode: "" });

  function finish() {
    setOpen(false);
    setStatus(null);
    onAdded();
  }

  async function addManual(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setLoading(false);
      return setStatus("Supabase não configurado.");
    }
    const tags = manual.tags.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 30);
    const { error } = await supabase.from("session_games").insert({
      session_id: sessionId,
      source: "manual",
      name: manual.name.trim(),
      normalized_name: normalizeName(manual.name),
      platforms: manual.platform.trim() ? [manual.platform.trim()] : [],
      store_url: manual.link.trim() || null,
      image_url: manual.image.trim() || null,
      description: manual.description.trim() || null,
      tags,
      features: tags,
      game_mode: manual.gameMode.trim() || null,
      added_by: userId,
    });
    setLoading(false);
    if (error) return setStatus(error.code === "23505" ? "Esse jogo já está na sessão." : "Não foi possível adicionar esse jogo.");
    setManual({ name: "", platform: "PC", link: "", description: "", image: "", tags: "", gameMode: "" });
    finish();
  }

  const field = (key: keyof typeof manual) => ({
    value: manual[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => setManual((current) => ({ ...current, [key]: event.target.value })),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="size-4" /> Adicionar jogo</Button></DialogTrigger>
      <DialogContent className="!inset-0 !h-[100dvh] !max-h-none !w-full !max-w-none !translate-x-0 !translate-y-0 !rounded-none !p-0 sm:!inset-auto sm:!left-1/2 sm:!top-1/2 sm:!h-[min(80vh,760px)] sm:!w-[min(960px,calc(100vw-48px))] sm:!-translate-x-1/2 sm:!-translate-y-1/2 sm:!rounded-2xl overflow-hidden flex flex-col">
        <header className="shrink-0 border-b border-border px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
          <p className="listed-eyebrow">Novo item</p>
          <DialogTitle className="mt-2 text-2xl font-semibold tracking-[-.03em]">Adicionar à lista</DialogTitle>
          <DialogDescription className="mt-2 pr-10 text-sm text-muted-foreground">Encontre o jogo pelo nome, AppID ou link oficial e confirme os dados antes de incluir.</DialogDescription>
        <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg border border-border bg-secondary p-1" role="tablist" aria-label="Método de inclusão">
          <button type="button" role="tab" aria-selected={mode === "steam"} onClick={() => setMode("steam")} className={`flex h-10 items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors ${mode === "steam" ? "bg-card text-foreground" : "text-muted-foreground"}`}><PackageSearch className="size-4" /> Steam</button>
          <button type="button" role="tab" aria-selected={mode === "manual"} onClick={() => setMode("manual")} className={`flex h-10 items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors ${mode === "manual" ? "bg-card text-foreground" : "text-muted-foreground"}`}><Gamepad2 className="size-4" /> Manual</button>
        </div>
        </header>

        {mode === "steam" ? <SteamGamePicker sessionId={sessionId} onAdded={finish} onCancel={() => setOpen(false)} onManualFallback={() => setMode("manual")} /> : (
          <form onSubmit={addManual} className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 sm:grid-cols-2 sm:p-6">
            <label className="space-y-2 sm:col-span-2"><span className="text-sm font-semibold">Nome *</span><Input {...field("name")} placeholder="Minecraft, Valorant, jogo de tabuleiro…" required minLength={2} /></label>
            <label className="space-y-2"><span className="text-sm font-semibold">Plataforma</span><Input {...field("platform")} placeholder="PC, Xbox, PlayStation…" /></label>
            <label className="space-y-2"><span className="text-sm font-semibold">Modo</span><Input {...field("gameMode")} placeholder="Online, local, cooperativo…" /></label>
            <label className="space-y-2 sm:col-span-2"><span className="text-sm font-semibold">Link</span><Input {...field("link")} type="url" placeholder="https://…" /></label>
            <label className="space-y-2 sm:col-span-2"><span className="text-sm font-semibold">Descrição</span><Input {...field("description")} maxLength={2000} placeholder="Resumo opcional" /></label>
            <label className="space-y-2"><span className="text-sm font-semibold">Imagem</span><Input {...field("image")} type="url" placeholder="https://…" /></label>
            <label className="space-y-2"><span className="text-sm font-semibold">Tags</span><Input {...field("tags")} placeholder="coop, casual, ação" /></label>
            {status ? <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive sm:col-span-2">{status}</p> : null}
            <Button type="submit" className="w-full sm:col-span-2" disabled={loading || manual.name.trim().length < 2}>{loading ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />} Adicionar à lista</Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
