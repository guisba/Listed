import type { OwnershipStatus, SessionGame } from "@/types/domain";

export const FILTER_GROUPS = {
  mode: ["singleplayer", "multiplayer", "coop", "coop-online", "coop-local"],
  ownership: ["owned-by-all", "owned-by-me", "owned-by-any", "owned-by-none"],
  platform: ["windows", "macos", "linux"],
  resource: ["controller-support", "remote-play", "pvp", "pvp-online"],
} as const;

export type FilterGroup = keyof typeof FILTER_GROUPS;
export type SessionFilterValue = (typeof FILTER_GROUPS)[FilterGroup][number];
export type ActiveSessionFilters = Record<FilterGroup, SessionFilterValue[]>;

export const EMPTY_SESSION_FILTERS: ActiveSessionFilters = {
  mode: [],
  ownership: [],
  platform: [],
  resource: [],
};

const ACCESS_STATUSES = new Set<OwnershipStatus>(["owns", "subscription", "free"]);
const GROUP_ENTRIES = Object.entries(FILTER_GROUPS) as Array<[FilterGroup, readonly SessionFilterValue[]]>;

function hasAccess(status: OwnershipStatus | undefined) {
  return status ? ACCESS_STATUSES.has(status) : false;
}

function matchesValue(game: SessionGame, value: SessionFilterValue, memberCount: number) {
  const features = new Set([...(game.features ?? []), ...(game.platforms ?? [])]);
  switch (value) {
    case "owned-by-all":
      return memberCount > 0 && (game.owner_count ?? 0) >= memberCount;
    case "owned-by-me":
      return hasAccess(game.ownership_status);
    case "owned-by-any":
      return (game.owner_count ?? 0) > 0;
    case "owned-by-none":
      return (game.owner_count ?? 0) === 0;
    default:
      return features.has(value);
  }
}

export function filterSessionGames(
  games: SessionGame[],
  filters: ActiveSessionFilters,
  memberCount: number,
) {
  return games.filter((game) =>
    GROUP_ENTRIES.every(([group]) => {
      const selected = filters[group];
      return selected.length === 0 || selected.some((value) => matchesValue(game, value, memberCount));
    }),
  );
}

export function countActiveSessionFilters(filters: ActiveSessionFilters) {
  return GROUP_ENTRIES.reduce((total, [group]) => total + filters[group].length, 0);
}

export function toggleSessionFilter(
  filters: ActiveSessionFilters,
  group: FilterGroup,
  value: SessionFilterValue,
) {
  const selected = filters[group];
  return {
    ...filters,
    [group]: selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value],
  };
}

export function serializeSessionFilters(filters: ActiveSessionFilters) {
  return GROUP_ENTRIES.flatMap(([group]) =>
    filters[group].map((value) => `${group}:${value}`),
  ).join(",");
}

export function parseSessionFilters(value: string | null | undefined): ActiveSessionFilters {
  const parsed: ActiveSessionFilters = {
    mode: [],
    ownership: [],
    platform: [],
    resource: [],
  };
  if (!value) return parsed;
  for (const item of value.split(",")) {
    const [candidateGroup, candidateValue] = item.split(":");
    const group = candidateGroup as FilterGroup;
    const allowed = FILTER_GROUPS[group] as readonly string[] | undefined;
    if (allowed?.includes(candidateValue) && !parsed[group].includes(candidateValue as SessionFilterValue)) {
      parsed[group].push(candidateValue as SessionFilterValue);
    }
  }
  return parsed;
}
