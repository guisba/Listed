"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Clock3, ShieldCheck, Sparkles, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ensureAnonymousUser, getBrowserSupabase } from "@/lib/supabase/browser";
import { createSessionSchema } from "@/lib/validation/sessions";

type FormValues = z.infer<typeof createSessionSchema>;

const methods = [
  ["multi_vote", "Votação múltipla", "Cada pessoa pode escolher vários jogos"],
  ["single_vote", "Voto único", "Uma escolha por participante"],
  ["weighted_random", "Sorteio ponderado", "Mais votos significam mais chances"],
  ["random", "Sorteio simples", "Todo jogo elegível tem a mesma chance"],
] as const;

export function CreateSessionForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(createSessionSchema),
    defaultValues: { decisionMethod: "multi_vote", expiryDays: 7 },
  });

  async function submit(values: FormValues) {
    setServerError(null);
    try {
      await ensureAnonymousUser(values.displayName);
      const supabase = getBrowserSupabase();
      if (!supabase) throw new Error("Configure o Supabase para criar uma sessão.");
      const { data, error } = await supabase.rpc("create_quick_session", {
        session_title: values.title,
        owner_display_name: values.displayName,
        method: values.decisionMethod,
        expiry_days: values.expiryDays,
      });
      if (error) throw error;
      const result = data as { public_code: string };
      router.push(`/s/${result.public_code}`);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Não foi possível criar a sessão.");
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-7" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="space-y-2 sm:col-span-2"><span className="text-sm font-semibold">Nome da lista</span><Input {...register("title")} placeholder="Ex: O que vamos jogar na sexta?" autoFocus />{errors.title ? <p className="text-xs text-destructive">{errors.title.message}</p> : null}</label>
        <label className="space-y-2"><span className="text-sm font-semibold">Como devemos chamar você?</span><Input {...register("displayName")} placeholder="Seu nome ou apelido" />{errors.displayName ? <p className="text-xs text-destructive">{errors.displayName.message}</p> : null}</label>
        <label className="space-y-2"><span className="text-sm font-semibold">Expira em</span><select {...register("expiryDays", { valueAsNumber: true })} className="h-12 w-full rounded-lg border border-input bg-background px-4 text-sm outline-none focus:border-primary focus:ring-3 focus:ring-primary/12"><option value={1}>24 horas</option><option value={3}>3 dias</option><option value={7}>7 dias</option><option value={14}>14 dias</option><option value={30}>30 dias</option></select></label>
      </div>
      <fieldset><legend className="mb-3 text-sm font-semibold">Como vocês querem decidir?</legend><div className="grid gap-2 sm:grid-cols-2">{methods.map(([value, label, description]) => <label key={value} className="selection-rail relative cursor-pointer rounded-lg border border-border bg-background p-4 transition-colors has-[:checked]:border-primary has-[:checked]:bg-accent/45" data-active="false"><input type="radio" value={value} {...register("decisionMethod")} className="peer sr-only" /><span className="block pr-6 font-semibold">{label}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span><span className="absolute right-4 top-4 size-3 rounded-full border border-border peer-checked:border-[4px] peer-checked:border-primary" /></label>)}</div></fieldset>
      <div className="border-y border-border py-4 text-xs text-muted-foreground"><div className="grid gap-3 sm:grid-cols-3"><span className="flex items-center gap-2"><Users className="size-4 text-primary" /> Convite por código</span><span className="flex items-center gap-2"><Clock3 className="size-4 text-primary" /> Expiração automática</span><span className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /> Acesso protegido</span></div></div>
      {serverError ? <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">{serverError}</div> : null}
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>{isSubmitting ? <><Sparkles className="size-4 animate-pulse" /> Preparando sua lista…</> : <>Criar lista <ArrowRight className="size-4" /></>}</Button>
      <p className="text-center text-xs leading-5 text-muted-foreground">Você entrará como visitante. Se apagar os dados do navegador, talvez não consiga recuperar esta identidade.</p>
    </form>
  );
}
