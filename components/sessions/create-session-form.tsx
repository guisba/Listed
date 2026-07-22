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
import { useI18n } from "@/i18n/client";

type FormValues = z.infer<typeof createSessionSchema>;

const methods = [
  ["multi_vote", "decision.multi_vote", "decision.multi_vote.description"],
  ["single_vote", "decision.single_vote", "decision.single_vote.description"],
  ["weighted_random", "decision.weighted_random", "decision.weighted_random.description"],
  ["random", "decision.random", "decision.random.description"],
] as const;

export function CreateSessionForm() {
  const router = useRouter();
  const { t } = useI18n();
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
      if (!supabase) throw new Error("missing_service");
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
      setServerError(error instanceof Error && error.message === "missing_service" ? t("create.supabaseMissing") : t("create.error"));
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-7" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="space-y-2 sm:col-span-2"><span className="text-sm font-semibold">{t("create.listName")}</span><Input {...register("title")} placeholder={t("create.listPlaceholder")} autoFocus />{errors.title ? <p className="text-xs text-destructive">{t("validation.title")}</p> : null}</label>
        <label className="space-y-2"><span className="text-sm font-semibold">{t("create.displayName")}</span><Input {...register("displayName")} placeholder={t("create.displayPlaceholder")} />{errors.displayName ? <p className="text-xs text-destructive">{t("validation.displayName")}</p> : null}</label>
        <label className="space-y-2"><span className="text-sm font-semibold">{t("create.expires")}</span><select {...register("expiryDays", { valueAsNumber: true })} className="h-12 w-full rounded-lg border border-input bg-background px-4 text-sm outline-none focus:border-primary focus:ring-3 focus:ring-primary/12"><option value={1}>{t("create.hours24")}</option>{[3, 7, 14, 30].map((count) => <option key={count} value={count}>{t("create.days", { count })}</option>)}</select></label>
      </div>
      <fieldset><legend className="mb-3 text-sm font-semibold">{t("create.decisionLegend")}</legend><div className="grid gap-2 sm:grid-cols-2">{methods.map(([value, label, description]) => <label key={value} className="selection-rail relative cursor-pointer rounded-lg border border-border bg-background p-4 transition-colors has-[:checked]:border-primary has-[:checked]:bg-accent/45" data-active="false"><input type="radio" value={value} {...register("decisionMethod")} className="peer sr-only" /><span className="block pr-6 font-semibold">{t(label)}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{t(description)}</span><span className="absolute right-4 top-4 size-3 rounded-full border border-border peer-checked:border-[4px] peer-checked:border-primary" /></label>)}</div></fieldset>
      <div className="border-y border-border py-4 text-xs text-muted-foreground"><div className="grid gap-3 sm:grid-cols-3"><span className="flex items-center gap-2"><Users className="size-4 text-primary" /> {t("create.inviteCode")}</span><span className="flex items-center gap-2"><Clock3 className="size-4 text-primary" /> {t("create.autoExpiry")}</span><span className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /> {t("create.protected")}</span></div></div>
      {serverError ? <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">{serverError}</div> : null}
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>{isSubmitting ? <><Sparkles className="size-4 animate-pulse" /> {t("create.preparing")}</> : <>{t("create.submit")} <ArrowRight className="size-4" /></>}</Button>
      <p className="text-center text-xs leading-5 text-muted-foreground">{t("create.anonymousNotice")}</p>
    </form>
  );
}
