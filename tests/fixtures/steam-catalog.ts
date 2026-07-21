import type { SteamCatalogPage } from "@/lib/steam/catalog-provider";

export function steamCatalogPage(start: number, count: number, haveMoreResults: boolean): SteamCatalogPage {
  const apps = Array.from({ length: count }, (_, index) => ({
    appid: start + index + 1,
    name: `Catalog Game ${start + index + 1}`,
    last_modified: 1_720_000_000 + index,
    price_change_number: index + 10,
  }));
  return {
    apps,
    have_more_results: haveMoreResults,
    last_appid: apps.at(-1)?.appid ?? start,
  };
}

export function largeSteamCatalog(size = 50_000) {
  return Array.from({ length: size }, (_, index) => ({
    appid: 3_000_000 + index,
    name: `Generated Catalog Game ${index.toString().padStart(6, "0")}`,
    last_modified: 1_720_000_000 + index,
    price_change_number: index,
  }));
}
