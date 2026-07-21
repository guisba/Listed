import "server-only";

import { z } from "zod";
import { SteamError, toSteamError } from "./errors";

export const STEAM_PUBLIC_WEB_API_BASE_URL = "https://api.steampowered.com";
export const STEAM_PARTNER_WEB_API_BASE_URL = "https://partner.steam-api.com";
const STEAM_CATALOG_PATH = "/IStoreService/GetAppList/v1/";

const steamCatalogItemSchema = z.object({
  appid: z.number().int().positive(),
  name: z.string().trim().min(1),
  last_modified: z.number().int().nonnegative().optional().default(0),
  price_change_number: z.number().int().nonnegative().optional().default(0),
}).passthrough();

const steamCatalogResponseSchema = z.object({
  response: z.object({
    apps: z.array(steamCatalogItemSchema),
    have_more_results: z.boolean().optional().default(false),
    last_appid: z.number().int().nonnegative().optional(),
  }).passthrough(),
}).passthrough();

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

export type SteamCatalogAuthMode = "query" | "header";

export interface CatalogPageOptions {
  lastAppId?: number;
  ifModifiedSince?: number;
  maxResults?: number;
  fetcher?: typeof fetch;
  attempts?: number;
  timeoutMs?: number;
  authMode?: SteamCatalogAuthMode;
}

interface CatalogRequestOptions extends CatalogPageOptions {
  baseUrl: string;
}

export type SteamCatalogProviderId =
  | "official_store_service"
  | "legacy_public_applist"
  | "individual_lookup";

export interface ProviderValidationResult {
  provider: SteamCatalogProviderId;
  accepted: boolean;
  reason:
    | "accepted"
    | "missing_key"
    | "invalid_key"
    | "wrong_api_host"
    | "publisher_key_required"
    | "ip_not_allowed"
    | "rate_limited"
    | "upstream_forbidden"
    | "unavailable";
}

export interface SteamCatalogProvider {
  readonly id: SteamCatalogProviderId;
  validate(): Promise<ProviderValidationResult>;
  fetchPage(options?: CatalogPageOptions): Promise<SteamCatalogPage>;
}

export interface SteamHostProbeResult {
  host: string;
  path: string;
  status: number | null;
  contentType: string | null;
  durationMs: number;
  appCount: number;
  nextLastAppId: number | null;
  hasMore: boolean;
  accepted: boolean;
  reason: ProviderValidationResult["reason"];
}

function configuredKey() {
  const value = process.env.STEAM_WEB_API_KEY?.trim();
  if (!value) return null;
  const quoted = (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"));
  return quoted ? value.slice(1, -1).trim() : value;
}

function responseError(status: number, baseUrl: string) {
  if (status === 401) return new SteamError("provider_invalid_key", 502);
  if (status === 403 && baseUrl === STEAM_PARTNER_WEB_API_BASE_URL) {
    return new SteamError("provider_publisher_key_required", 502);
  }
  if (status === 403) return new SteamError("provider_upstream_forbidden", 502);
  if (status === 429) return new SteamError("rate_limited", 429);
  return new SteamError("provider_unavailable", 502);
}

function validationReason(error: unknown): ProviderValidationResult["reason"] {
  if (!(error instanceof SteamError)) return "unavailable";
  if (error.code === "provider_invalid_key") return "invalid_key";
  if (error.code === "provider_publisher_key_required") return "publisher_key_required";
  if (error.code === "provider_upstream_forbidden") return "upstream_forbidden";
  if (error.code === "rate_limited") return "rate_limited";
  return "unavailable";
}

function buildRequest({
  baseUrl,
  lastAppId = 0,
  ifModifiedSince = 0,
  maxResults = 1_000,
  authMode = "query",
}: Pick<CatalogRequestOptions, "baseUrl" | "lastAppId" | "ifModifiedSince" | "maxResults" | "authMode">) {
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
  const params = new URLSearchParams({ input_json: inputJson });
  const headers = new Headers({ Accept: "application/json" });
  if (authMode === "query") params.set("key", key);
  else headers.set("x-webapi-key", key);

  return {
    url: `${baseUrl}${STEAM_CATALOG_PATH}?${params}`,
    init: { signal: undefined, cache: "no-store" as const, headers },
  };
}

async function parseCatalogResponse(response: Response): Promise<SteamCatalogPage> {
  const contentType = response.headers.get("content-type");
  if (!contentType?.toLowerCase().includes("application/json")) {
    throw new SteamError("provider_unavailable", 502);
  }

  const body = await response.text();
  if (/^\s*</.test(body)) throw new SteamError("provider_unavailable", 502);
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch (error) {
    throw new SteamError("provider_unavailable", 502, { cause: error });
  }
  const parsed = steamCatalogResponseSchema.safeParse(raw);
  if (!parsed.success) throw new SteamError("provider_unavailable", 502);

  const apps = parsed.data.response.apps;
  const lastAppId = parsed.data.response.last_appid ?? apps.at(-1)?.appid ?? 0;
  if (parsed.data.response.have_more_results && (!apps.length || lastAppId <= 0)) {
    throw new SteamError("provider_unavailable", 502);
  }
  return {
    apps,
    have_more_results: parsed.data.response.have_more_results,
    last_appid: lastAppId,
  };
}

async function requestCatalogPage({
  baseUrl,
  fetcher = fetch,
  attempts = 3,
  timeoutMs = 12_000,
  ...pageOptions
}: CatalogRequestOptions) {
  const request = buildRequest({ baseUrl, ...pageOptions });
  let response: Response | null = null;
  let durationMs = 0;
  const maxAttempts = Math.min(Math.max(attempts, 1), 4);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const startedAt = performance.now();
    try {
      response = await fetcher(request.url, {
        ...request.init,
        signal: AbortSignal.timeout(timeoutMs),
      });
      durationMs += performance.now() - startedAt;
    } catch (error) {
      durationMs += performance.now() - startedAt;
      if (attempt + 1 >= maxAttempts) throw toSteamError(error);
      continue;
    }
    if (response.ok) break;
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt + 1 >= maxAttempts) break;
  }

  if (!response?.ok) {
    const mapped = responseError(response?.status ?? 502, baseUrl);
    throw new SteamError(mapped.code, mapped.status, {
      cause: {
        upstreamStatus: response?.status ?? null,
        contentType: response?.headers.get("content-type") ?? null,
        durationMs: Math.round(durationMs),
      },
    });
  }
  return { response, durationMs: Math.round(durationMs) };
}

export async function fetchSteamCatalogPage(options: CatalogPageOptions = {}) {
  const { response } = await requestCatalogPage({
    ...options,
    baseUrl: STEAM_PUBLIC_WEB_API_BASE_URL,
  });
  return parseCatalogResponse(response);
}

async function probeSteamCatalogHost(baseUrl: string, fetcher: typeof fetch): Promise<SteamHostProbeResult> {
  const startedAt = performance.now();
  let response: Response | null = null;
  try {
    const requested = await requestCatalogPage({
      baseUrl,
      lastAppId: 0,
      maxResults: 10,
      attempts: 1,
      authMode: "query",
      fetcher,
    });
    response = requested.response;
    const page = await parseCatalogResponse(response);
    return {
      host: new URL(baseUrl).host,
      path: STEAM_CATALOG_PATH,
      status: response.status,
      contentType: response.headers.get("content-type"),
      durationMs: requested.durationMs,
      appCount: page.apps.length,
      nextLastAppId: page.have_more_results ? page.last_appid : null,
      hasMore: page.have_more_results,
      accepted: true,
      reason: "accepted",
    };
  } catch (error) {
    const cause = error instanceof SteamError && error.cause && typeof error.cause === "object"
      ? error.cause as { upstreamStatus?: number | null; contentType?: string | null; durationMs?: number }
      : null;
    return {
      host: new URL(baseUrl).host,
      path: STEAM_CATALOG_PATH,
      status: response?.status ?? cause?.upstreamStatus ?? null,
      contentType: response?.headers.get("content-type") ?? cause?.contentType ?? null,
      durationMs: cause?.durationMs ?? Math.round(performance.now() - startedAt),
      appCount: 0,
      nextLastAppId: null,
      hasMore: false,
      accepted: false,
      reason: validationReason(error),
    };
  }
}

export async function validateSteamCatalogHosts(fetcher: typeof fetch = fetch) {
  if (!configuredKey()) {
    const missing = (baseUrl: string): SteamHostProbeResult => ({
      host: new URL(baseUrl).host,
      path: STEAM_CATALOG_PATH,
      status: null,
      contentType: null,
      durationMs: 0,
      appCount: 0,
      nextLastAppId: null,
      hasMore: false,
      accepted: false,
      reason: "missing_key",
    });
    return {
      publicHost: missing(STEAM_PUBLIC_WEB_API_BASE_URL),
      partnerHost: missing(STEAM_PARTNER_WEB_API_BASE_URL),
    };
  }

  const publicHost = await probeSteamCatalogHost(STEAM_PUBLIC_WEB_API_BASE_URL, fetcher);
  const partnerHost = await probeSteamCatalogHost(STEAM_PARTNER_WEB_API_BASE_URL, fetcher);
  return { publicHost, partnerHost };
}

export class OfficialStoreServiceProvider implements SteamCatalogProvider {
  readonly id = "official_store_service" as const;

  async validate(): Promise<ProviderValidationResult> {
    if (!configuredKey()) return { provider: this.id, accepted: false, reason: "missing_key" };
    try {
      await this.fetchPage({ lastAppId: 0, maxResults: 1, attempts: 1 });
      return { provider: this.id, accepted: true, reason: "accepted" };
    } catch (error) {
      return { provider: this.id, accepted: false, reason: validationReason(error) };
    }
  }

  fetchPage(options: CatalogPageOptions = {}) {
    return fetchSteamCatalogPage(options);
  }
}
