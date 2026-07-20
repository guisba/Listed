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
}

export async function fetchSteamCatalogPage({
  lastAppId = 0,
  ifModifiedSince = 0,
  maxResults = 1_000,
  fetcher = fetch,
}: CatalogPageOptions = {}) {
  const key = process.env.STEAM_WEB_API_KEY;
  if (!key) throw new SteamError("sync_not_configured", 503);

  const inputJson = JSON.stringify({
    if_modified_since: ifModifiedSince || undefined,
    include_games: true,
    include_dlc: false,
    include_software: false,
    include_videos: false,
    include_hardware: false,
    last_appid: lastAppId,
    max_results: Math.min(Math.max(maxResults, 100), 5_000),
  });
  const params = new URLSearchParams({ key, input_json: inputJson });

  let response: Response;
  try {
    response = await fetcher(
      `https://partner.steam-api.com/IStoreService/GetAppList/v1/?${params}`,
      { signal: AbortSignal.timeout(12_000), cache: "no-store", headers: { Accept: "application/json" } },
    );
  } catch (error) {
    throw toSteamError(error);
  }
  if (!response.ok) throw new SteamError("provider_unavailable", 502);
  const payload = (await response.json()) as { response?: SteamCatalogPage };
  if (!payload.response || !Array.isArray(payload.response.apps)) {
    throw new SteamError("provider_unavailable", 502);
  }
  return payload.response;
}
