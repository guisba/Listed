import "server-only";

import { unstable_cache } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { safeSteamImageUrl } from "@/lib/steam/image";

export const LANDING_DEMO_APP_IDS = [728880, 105600, 730] as const;

const FALLBACK_NAMES: Record<(typeof LANDING_DEMO_APP_IDS)[number], string> = {
  728880: "Overcooked! 2",
  105600: "Terraria",
  730: "Counter-Strike 2",
};

export interface LandingDemoGame {
  appid: (typeof LANDING_DEMO_APP_IDS)[number];
  name: string;
  capsuleImageUrl: string | null;
  headerImageUrl: string | null;
  platforms: string[];
  genresCount: number;
  categoriesCount: number;
  features: string[];
  releaseYear: string | null;
  storeUrl: string;
  metadataAvailable: boolean;
}

type Row = Record<string, unknown>;

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function buildLandingDemoGames(indexRows: Row[], catalogRows: Row[]): LandingDemoGame[] {
  const index = new Map(indexRows.map((row) => [Number(row.appid), row]));
  const catalog = new Map(catalogRows.map((row) => [Number(row.steam_appid), row]));
  return LANDING_DEMO_APP_IDS.map((appid) => {
    const indexRow = index.get(appid);
    const catalogRow = catalog.get(appid);
    const releaseDate = typeof catalogRow?.release_date === "string" ? catalogRow.release_date : "";
    return {
      appid,
      name: typeof catalogRow?.name === "string" ? catalogRow.name : typeof indexRow?.name === "string" ? indexRow.name : FALLBACK_NAMES[appid],
      capsuleImageUrl: safeSteamImageUrl(catalogRow?.cover_image) ?? safeSteamImageUrl(indexRow?.capsule_image_url),
      headerImageUrl: safeSteamImageUrl(catalogRow?.header_image) ?? safeSteamImageUrl(indexRow?.header_image_url),
      platforms: strings(catalogRow?.platforms),
      genresCount: strings(catalogRow?.genres).length,
      categoriesCount: strings(catalogRow?.categories).length,
      features: strings(catalogRow?.features),
      releaseYear: releaseDate.match(/\b\d{4}\b/)?.[0] ?? null,
      storeUrl: typeof catalogRow?.store_url === "string" ? catalogRow.store_url : `https://store.steampowered.com/app/${appid}/`,
      metadataAvailable: Boolean(catalogRow),
    };
  });
}

const readLandingDemoGames = unstable_cache(async () => {
  const admin = getSupabaseAdmin();
  if (!admin) return buildLandingDemoGames([], []);
  const [indexResult, catalogResult] = await Promise.all([
    admin.from("steam_app_index").select("appid,name,capsule_image_url,header_image_url").in("appid", [...LANDING_DEMO_APP_IDS]),
    admin.from("catalog_games").select("steam_appid,name,store_url,cover_image,header_image,release_date,platforms,genres,categories,features").in("steam_appid", [...LANDING_DEMO_APP_IDS]),
  ]);
  if (indexResult.error || catalogResult.error) return buildLandingDemoGames(indexResult.data ?? [], catalogResult.data ?? []);
  return buildLandingDemoGames(indexResult.data ?? [], catalogResult.data ?? []);
}, ["landing-demo-games-v2"], { revalidate: 60 * 60 * 12, tags: ["landing-demo-games"] });

export async function getLandingDemoGames() {
  return readLandingDemoGames();
}
