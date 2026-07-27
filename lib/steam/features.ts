interface SteamCategory {
  id?: number;
  description: string;
}

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

const CATEGORY_ID_FEATURES: Record<number, string> = {
  1: "multiplayer",
  2: "singleplayer",
  9: "coop",
  24: "coop-local",
  28: "controller-support",
  36: "pvp-online",
  37: "pvp-local",
  38: "coop-online",
  39: "coop-local",
  44: "remote-play",
  49: "pvp",
};

export function normalizeSteamFeatures(
  categories: SteamCategory[],
  platforms: Record<string, boolean>,
  isFree: boolean,
) {
  const features = new Set<string>();
  for (const category of categories) {
    if (category.id && CATEGORY_ID_FEATURES[category.id]) {
      features.add(CATEGORY_ID_FEATURES[category.id]);
    }
    const name = category.description;
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
