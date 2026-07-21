const STEAM_IMAGE_HOSTS = new Set([
  "shared.akamai.steamstatic.com",
]);

export type SteamImageStatus = "unknown" | "available" | "missing" | "failed" | "stale";

export const STEAM_IMAGE_MISSING_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
export const STEAM_IMAGE_FAILED_TTL_MS = 30 * 60 * 1_000;
export const STEAM_IMAGE_ENRICH_BATCH_LIMIT = 12;
export const STEAM_IMAGE_ENRICH_CONCURRENCY = 3;

export function safeSteamImageUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 2_048) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:"
      || url.username
      || url.password
      || url.port
      || !STEAM_IMAGE_HOSTS.has(url.hostname.toLowerCase())
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function isImageStatusFresh(status: SteamImageStatus, updatedAt: string | null, now = Date.now()) {
  if (!updatedAt) return false;
  const age = now - Date.parse(updatedAt);
  if (!Number.isFinite(age) || age < 0) return false;
  if (status === "missing") return age < STEAM_IMAGE_MISSING_TTL_MS;
  if (status === "failed") return age < STEAM_IMAGE_FAILED_TTL_MS;
  return status === "available";
}
