import "server-only";

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

export async function fetchSteamCatalogPage(lastAppId = 0) {
  const key = process.env.STEAM_WEB_API_KEY;
  if (!key) throw new Error("STEAM_WEB_API_KEY não configurada.");

  const inputJson = JSON.stringify({
    key,
    include_games: true,
    include_dlc: false,
    include_software: false,
    include_videos: false,
    include_hardware: false,
    last_appid: lastAppId,
    max_results: 1_000,
  });
  const response = await fetch(
    `https://partner.steam-api.com/IStoreService/GetAppList/v1/?input_json=${encodeURIComponent(inputJson)}`,
    { signal: AbortSignal.timeout(12_000), cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Steam catalog respondeu ${response.status}.`);
  const payload = (await response.json()) as { response: SteamCatalogPage };
  return payload.response;
}
