export type SteamMetadataStatus = "pending" | "complete" | "partial" | "failed" | "stale";

export interface SteamGame {
  appid: number;
  name: string;
  type: string;
  storeUrl: string;
  headerImage: string | null;
  shortDescription: string | null;
  releaseDate: string | null;
  platforms: string[];
  genres: string[];
  categories: string[];
  features: string[];
  isFree: boolean;
  metadataStatus: SteamMetadataStatus;
}

export interface SteamProvider {
  getApp(appid: number): Promise<SteamGame | null>;
}
