import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";

let admin: SupabaseClient | null = null;

export function getSupabaseAdmin() {
  const env = getPublicEnv();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!env || !secret) return null;

  admin ??= createClient(env.NEXT_PUBLIC_SUPABASE_URL, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return admin;
}
