const FEATURE_MAP: Array<[RegExp, string]> = [
  [/single-player/i, "singleplayer"],
  [/multi-player|multiplayer/i, "multiplayer"],
  [/shared\/split screen co-op|local co-op/i, "coop-local"],
  [/online co-op/i, "coop-online"],
  [/shared\/split screen pvp|local pvp/i, "pvp-local"],
  [/online pvp/i, "pvp-online"],
  [/cross-platform multiplayer/i, "crossplay"],
  [/controller/i, "controller-support"],
];

export function normalizeSteamFeatures(
  categoryNames: string[],
  platforms: Record<string, boolean>,
  isFree: boolean,
) {
  const features = new Set<string>();
  for (const name of categoryNames) {
    for (const [pattern, feature] of FEATURE_MAP) {
      if (pattern.test(name)) features.add(feature);
    }
  }
  if (isFree) features.add("free-to-play");
  if (platforms.windows) features.add("windows");
  if (platforms.mac) features.add("macos");
  if (platforms.linux) features.add("linux");
  return [...features];
}
