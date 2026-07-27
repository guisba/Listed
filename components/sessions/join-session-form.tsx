"use client";

import { ArrowRight, LogIn, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ensureAnonymousUser, getBrowserSupabase } from "@/lib/supabase/browser";
import { joinSessionSchema } from "@/lib/validation/sessions";
import { useI18n } from "@/i18n/client";

export function JoinSessionForm({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [code, setCode] = useState(initialCode);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = joinSessionSchema.safeParse({ code, displayName });
    if (!parsed.success) return setError(t("join.invalid"));
    setIsLoading(true); setError(null);
    try {
      await ensureAnonymousUser(parsed.data.displayName);
      const supabase = getBrowserSupabase();
      if (!supabase) throw new Error("missing_service");
      const { data, error: rpcError } = await supabase.rpc("join_session", { session_code: parsed.data.code, member_display_name: parsed.data.displayName });
      if (rpcError) throw rpcError;
      const result = data as { public_code: string };
      router.push(`/s/${result.public_code}`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      setError(t(message.includes("Acesso bloqueado") ? "join.banned" : "join.error"));
      setIsLoading(false);
    }
  }

  return <form onSubmit={submit} className="space-y-5"><label className="block space-y-2"><span className="text-sm font-semibold">{t("join.code")}</span><Input value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 6))} placeholder="7KQ9XM" className="h-14 text-center font-mono text-xl font-semibold uppercase tracking-[.25em]" autoFocus /></label><label className="block space-y-2"><span className="text-sm font-semibold">{t("join.name")}</span><Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={t("join.namePlaceholder")} maxLength={40} /></label>{error ? <div role="alert" className="flex gap-3 rounded-lg border border-destructive/25 bg-destructive/10 p-4 text-sm"><ShieldAlert className="mt-0.5 size-4 shrink-0" />{error}</div> : null}<Button type="submit" size="lg" className="w-full" disabled={isLoading}>{isLoading ? <><LogIn className="size-4 animate-pulse" /> {t("join.entering")}</> : <>{t("join.submit")} <ArrowRight className="size-4" /></>}</Button></form>;
}
