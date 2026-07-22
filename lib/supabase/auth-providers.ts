import "server-only";

import { z } from "zod";
import { getPublicEnv } from "@/lib/env";

const authSettingsSchema = z.object({
  external: z
    .object({
      google: z.boolean().optional(),
      discord: z.boolean().optional(),
    })
    .passthrough()
    .optional(),
});

export type AuthProviderAvailability = {
  google: boolean;
  discord: boolean;
};

const unavailableProviders: AuthProviderAvailability = {
  google: false,
  discord: false,
};

export function parseAuthProviderAvailability(
  payload: unknown,
): AuthProviderAvailability {
  const parsed = authSettingsSchema.safeParse(payload);

  if (!parsed.success) return unavailableProviders;

  return {
    google: parsed.data.external?.google === true,
    discord: parsed.data.external?.discord === true,
  };
}

export async function getAuthProviderAvailability(): Promise<AuthProviderAvailability> {
  const env = getPublicEnv();
  if (!env) return unavailableProviders;

  try {
    const settingsUrl = new URL("/auth/v1/settings", env.NEXT_PUBLIC_SUPABASE_URL);
    const response = await fetch(settingsUrl, {
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) return unavailableProviders;
    return parseAuthProviderAvailability(await response.json());
  } catch {
    return unavailableProviders;
  }
}
