import "server-only";

import { SteamError, toSteamError } from "./errors";

export interface SteamCatalogPage {
  apps: Array<{
    appid: number;
    name: string;
    last_modified: number;
    price_change_number: number;
  }>;
  have_more_results: boolean;
  last_appid: number;
}

export interface CatalogPageOptions {
  lastAppId?: number;
  ifModifiedSince?: number;
  maxResults?: number;
  fetcher?: typeof fetch;
  attempts?: number;
  timeoutMs?: number;
}

export type SteamCatalogProviderId = "official_store_service";

export interface ProviderValidationResult {
  provider: SteamCatalogProviderId;
  accepted: boolean;
  reason: "accepted" | "missing_key" | "rejected" | "unavailable";
}

export interface SteamCatalogProvider {
  readonly id: SteamCatalogProviderId;
  validate(): Promise<ProviderValidationResult>;
  fetchPage(options?: CatalogPageOptions): Promise<SteamCatalogPage>;
}

function configuredKey() {
  const value = process.env.STEAM_WEB_API_KEY?.trim();
  if (!value) return null;
  const quoted = (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"));
  return quoted ? value.slice(1, -1).trim() : value;
}

function responseError(status: number) {
  if (status === 401 || status === 403) return new SteamError("provider_auth_rejected", 502);
  if (status === 429) return new SteamError("rate_limited", 429);
  return new SteamError("provider_unavailable", 502);
}

export async function fetchSteamCatalogPage({
  lastAppId = 0,
  ifModifiedSince = 0,
  maxResults = 1_000,
  fetcher = fetch,
  attempts = 3,
  timeoutMs = 12_000,
}: CatalogPageOptions = {}) {
  const key = configuredKey();
  if (!key) throw new SteamError("sync_not_configured", 503);

  const inputJson = JSON.stringify({
    if_modified_since: ifModifiedSince || undefined,
    include_games: true,
    include_dlc: false,
    include_software: false,
    include_videos: false,
    include_hardware: false,
    last_appid: lastAppId,
    max_results: Math.min(Math.max(maxResults, 1), 50_000),
  });
  const params = new URLSearchParams({ key, input_json: inputJson });

  let response: Response | null = null;
  for (let attempt = 0; attempt < Math.min(Math.max(attempts, 1), 4); attempt += 1) {
    try {
      response = await fetcher(
        `https://partner.steam-api.com/IStoreService/GetAppList/v1/?${params}`,
        { signal: AbortSignal.timeout(timeoutMs), cache: "no-store", headers: { Accept: "application/json" } },
      );
    } catch (error) {
      if (attempt + 1 >= attempts) throw toSteamError(error);
      continue;
    }
    if (response.ok) break;
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt + 1 >= attempts) break;
  }
  if (!response?.ok) throw responseError(response?.status ?? 502);
  const payload = (await response.json()) as { response?: SteamCatalogPage };
  if (!payload.response || !Array.isArray(payload.response.apps)) {
    throw new SteamError("provider_unavailable", 502);
  }
  return payload.response;
}

export class OfficialStoreServiceProvider implements SteamCatalogProvider {
  readonly id = "official_store_service" as const;

  async validate(): Promise<ProviderValidationResult> {
    if (!configuredKey()) return { provider: this.id, accepted: false, reason: "missing_key" };
    try {
      await this.fetchPage({ lastAppId: 0, maxResults: 1, attempts: 1 });
      return { provider: this.id, accepted: true, reason: "accepted" };
    } catch (error) {
      return {
        provider: this.id,
        accepted: false,
        reason: error instanceof SteamError && error.code === "provider_auth_rejected" ? "rejected" : "unavailable",
      };
    }
  }

  fetchPage(options: CatalogPageOptions = {}) {
    return fetchSteamCatalogPage(options);
  }
}
