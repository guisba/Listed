"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";

let client: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient | null {
  const env = getPublicEnv();
  if (!env) return null;

  client ??= createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  return client;
}

export async function ensureAnonymousUser(displayName?: string) {
  const supabase = getBrowserSupabase();
  if (!supabase) throw new Error("Supabase ainda não foi configurado.");

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user) return sessionData.session.user;

  const { data, error } = await supabase.auth.signInAnonymously({
    options: displayName ? { data: { display_name: displayName } } : undefined,
  });
  if (error || !data.user) {
    throw new Error(
      error?.message ?? "Não foi possível criar sua identidade temporária.",
    );
  }
  return data.user;
}
