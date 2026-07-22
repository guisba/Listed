"use client";

import { AtSign, Globe2, LoaderCircle, Mail, MessageCircle } from "lucide-react";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { useI18n } from "@/i18n/client";

export function LoginForm() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function emailLogin(event: FormEvent) {
    event.preventDefault(); setLoading(true); setStatus(null);
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setLoading(false);
      return setStatus(t("login.error"));
    }
    const { data: userData } = await supabase.auth.getUser();
    const redirect = `${window.location.origin}/auth/callback`;
    const result = userData.user?.is_anonymous
      ? await supabase.auth.updateUser({ email })
      : await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect, shouldCreateUser: true } });
    setLoading(false);
    setStatus(result.error ? t("login.error") : t("login.checkEmail"));
  }

  async function oauth(provider: "google" | "discord") {
    const supabase = getBrowserSupabase(); if (!supabase) return;
    const { data: userData } = await supabase.auth.getUser();
    const redirectTo = `${window.location.origin}/auth/callback`;
    const result = userData.user?.is_anonymous
      ? await supabase.auth.linkIdentity({ provider, options: { redirectTo } })
      : await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
    if (result.error) setStatus(t("login.error"));
  }

  return <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2"><Button variant="secondary" onClick={() => oauth("google")}><Globe2 className="size-4" /> Google</Button><Button variant="secondary" onClick={() => oauth("discord")}><MessageCircle className="size-4" /> Discord</Button></div><div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />{t("login.orEmail")}<span className="h-px flex-1 bg-border" /></div><form onSubmit={emailLogin} className="space-y-3"><label className="block space-y-2"><span className="text-sm font-semibold">{t("login.email")}</span><div className="relative"><AtSign className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t("login.emailPlaceholder")} className="pl-11" required /></div></label><Button className="w-full" type="submit" disabled={loading}>{loading ? <LoaderCircle className="size-4 animate-spin" /> : <Mail className="size-4" />} {t("login.magicLink")}</Button></form>{status ? <p role="status" className="rounded-lg border border-border bg-secondary p-4 text-sm">{status}</p> : null}<p className="text-xs leading-5 text-muted-foreground">{t("login.preserve")}</p></div>;
}
