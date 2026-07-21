export type SteamMetadataStatus = "pending" | "complete" | "partial" | "failed" | "stale";

export interface SteamPrice {
  currency: string;
  initial: number;
  final: number;
  discountPercent: number;
  formatted: string | null;
}

export interface SteamGame {
  appid: number;
  name: string;
  type: string;
  storeUrl: string;
  headerImage: string | null;
  capsuleImage: string | null;
  coverImage: string | null;
  shortDescription: string | null;
  fullDescription: string | null;
  releaseDate: string | null;
  comingSoon: boolean;
  platforms: string[];
  genres: string[];
  categories: string[];
  features: string[];
  developers: string[];
  publishers: string[];
  supportedLanguages: string[];
  price: SteamPrice | null;
  isFree: boolean;
  recommendationsTotal: number | null;
  metadataStatus: SteamMetadataStatus;
}

export interface SteamGamePreview extends SteamGame {
  id: string | null;
  cacheState: "fresh" | "stale" | "refreshed" | "uncached";
  warning?: string;
}

export interface SteamSearchMatch {
  appid: number;
  name: string;
  type: string;
  id: string | null;
  headerImage: string | null;
  capsuleImageUrl: string | null;
  imageStatus: "unknown" | "available" | "missing" | "failed" | "stale";
  releaseDate: string | null;
  platforms: string[];
  relevance: number;
  matchKind?: "appid_exact" | "exact" | "normalized_exact" | "prefix" | "word_prefix" | "similarity" | "contains";
  metadataStatus: SteamMetadataStatus | null;
  cacheExpiresAt: string | null;
  source?: "official_store_service" | "legacy_public_applist" | "individual_lookup";
}

export interface SteamProvider {
  readonly id: "individual_lookup";
  getApp(appid: number): Promise<SteamGame | null>;
}
