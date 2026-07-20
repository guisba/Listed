import "server-only";

import { normalizeSteamFeatures } from "./features";
import { stripExternalHtml } from "./input";
import type { SteamGame, SteamProvider } from "./types";

interface StoreResponse {
  success: boolean;
  data?: {
    type?: string;
    name?: string;
    header_image?: string;
    short_description?: string;
    is_free?: boolean;
    platforms?: Record<string, boolean>;
    genres?: Array<{ description: string }>;
    categories?: Array<{ description: string }>;
    release_date?: { date?: string };
  };
}

export class SteamStoreProvider implements SteamProvider {
  async getApp(appid: number): Promise<SteamGame | null> {
    const params = new URLSearchParams({
      appids: String(appid),
      cc: "BR",
      l: "brazilian",
    });
    const response = await fetch(
      `https://store.steampowered.com/api/appdetails?${params}`,
      { signal: AbortSignal.timeout(6_000), cache: "no-store" },
    );
    if (!response.ok) throw new Error("Steam indisponível no momento.");

    const payload = (await response.json()) as Record<string, StoreResponse>;
    const item = payload[String(appid)];
    if (!item?.success || !item.data?.name) return null;

    const platforms = item.data.platforms ?? {};
    const categoryNames = (item.data.categories ?? []).map(
      (category) => category.description,
    );
    return {
      appid,
      name: item.data.name,
      type: item.data.type ?? "game",
      storeUrl: `https://store.steampowered.com/app/${appid}/`,
      headerImage: item.data.header_image ?? null,
      shortDescription: stripExternalHtml(item.data.short_description),
      releaseDate: item.data.release_date?.date ?? null,
      platforms: Object.entries(platforms)
        .filter(([, supported]) => supported)
        .map(([platform]) => (platform === "mac" ? "macos" : platform)),
      genres: (item.data.genres ?? []).map((genre) => genre.description),
      categories: categoryNames,
      features: normalizeSteamFeatures(
        categoryNames,
        platforms,
        Boolean(item.data.is_free),
      ),
      isFree: Boolean(item.data.is_free),
      metadataStatus: "complete",
    };
  }
}
