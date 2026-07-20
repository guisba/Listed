import "server-only";

import { normalizeSteamFeatures } from "./features";
import { stripExternalHtml } from "./input";
import { SteamError, toSteamError } from "./errors";
import type { SteamGame, SteamPrice, SteamProvider } from "./types";

interface StoreData {
  type?: string;
  name?: string;
  header_image?: string;
  capsule_imagev5?: string;
  short_description?: string;
  detailed_description?: string;
  is_free?: boolean;
  platforms?: Record<string, boolean>;
  genres?: Array<{ description: string }>;
  categories?: Array<{ description: string }>;
  developers?: string[];
  publishers?: string[];
  supported_languages?: string;
  price_overview?: {
    currency?: string;
    initial?: number;
    final?: number;
    discount_percent?: number;
    final_formatted?: string;
  };
  release_date?: { coming_soon?: boolean; date?: string };
}

interface StoreResponse { success: boolean; data?: StoreData }

function normalizePrice(data: StoreData): SteamPrice | null {
  const price = data.price_overview;
  if (!price?.currency || typeof price.initial !== "number" || typeof price.final !== "number") return null;
  return {
    currency: price.currency,
    initial: price.initial,
    final: price.final,
    discountPercent: price.discount_percent ?? 0,
    formatted: price.final_formatted ?? null,
  };
}

function normalizeLanguages(value?: string) {
  if (!value) return [];
  return value
    .replace(/<[^>]*>/g, "")
    .split(",")
    .map((language) => language.replace(/\*/g, "").trim())
    .filter(Boolean)
    .slice(0, 40);
}

export class SteamStoreProvider implements SteamProvider {
  constructor(
    private readonly fetcher: typeof fetch = fetch,
    private readonly timeoutMs = 6_000,
    private readonly attempts = 2,
  ) {}

  async getApp(appid: number): Promise<SteamGame | null> {
    const params = new URLSearchParams({ appids: String(appid), cc: "BR", l: "brazilian" });
    const url = `https://store.steampowered.com/api/appdetails?${params}`;
    let response: Response | null = null;

    for (let attempt = 0; attempt < this.attempts; attempt += 1) {
      try {
        response = await this.fetcher(url, {
          signal: AbortSignal.timeout(this.timeoutMs),
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
      } catch (error) {
        if (attempt + 1 === this.attempts) throw toSteamError(error);
        continue;
      }
      if (response.ok) break;
      if (![429, 500, 502, 503, 504].includes(response.status) || attempt + 1 === this.attempts) {
        throw new SteamError("provider_unavailable", 502);
      }
    }

    if (!response?.ok) throw new SteamError("provider_unavailable", 502);
    let payload: Record<string, StoreResponse>;
    try {
      payload = (await response.json()) as Record<string, StoreResponse>;
    } catch (error) {
      throw new SteamError("provider_unavailable", 502, { cause: error });
    }
    const item = payload[String(appid)];
    if (!item?.success || !item.data?.name) return null;

    const data = item.data;
    const name = data.name as string;
    const platforms = data.platforms ?? {};
    const categoryNames = (data.categories ?? []).map((category) => category.description).filter(Boolean);
    const shortDescription = stripExternalHtml(data.short_description)?.slice(0, 2_000) ?? null;
    const fullDescription = stripExternalHtml(data.detailed_description);
    const enoughMetadata = Boolean(data.header_image && shortDescription && Object.keys(platforms).length);

    return {
      appid,
      name,
      type: data.type ?? "game",
      storeUrl: `https://store.steampowered.com/app/${appid}/`,
      headerImage: data.header_image ?? null,
      coverImage: data.capsule_imagev5 ?? data.header_image ?? null,
      shortDescription,
      fullDescription,
      releaseDate: data.release_date?.date ?? null,
      comingSoon: Boolean(data.release_date?.coming_soon),
      platforms: Object.entries(platforms)
        .filter(([, supported]) => supported)
        .map(([platform]) => (platform === "mac" ? "macos" : platform)),
      genres: (data.genres ?? []).map((genre) => genre.description).filter(Boolean),
      categories: categoryNames,
      features: normalizeSteamFeatures(categoryNames, platforms, Boolean(data.is_free)),
      developers: data.developers?.filter(Boolean) ?? [],
      publishers: data.publishers?.filter(Boolean) ?? [],
      supportedLanguages: normalizeLanguages(data.supported_languages),
      price: normalizePrice(data),
      isFree: Boolean(data.is_free),
      metadataStatus: enoughMetadata ? "complete" : "partial",
    };
  }
}
