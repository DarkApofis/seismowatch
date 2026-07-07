import {
  FEED_MAGNITUDES,
  FEED_WINDOWS,
  type FeedMagnitude,
  type FeedWindow,
  type SummaryFeed,
} from "./api";

/**
 * The complete, URL-serializable filter state for the dashboard.
 *
 * The URL is the single source of truth for this state (see
 * `hooks/useEarthquakeFilters`). Every field has a default; the serializer
 * omits defaults so shared URLs stay clean, and the parser falls back to the
 * default on any missing or corrupt value (silent, never throws).
 *
 * `feedMagnitude` + `timeWindow` select which USGS feed file to fetch (server
 * side); the remaining fields refine that feed on the client.
 */
export interface Filters {
  feedMagnitude: FeedMagnitude;
  timeWindow: FeedWindow;
  /** Lower magnitude bound; `null` means no bound. */
  minMagnitude: number | null;
  /** Upper depth bound in km; `null` means no bound. */
  maxDepth: number | null;
  /** Case-insensitive substring match against `place`; `""` means no filter. */
  searchText: string;
  sortBy: SortField;
  sortDir: SortDirection;
}

export const SORT_FIELDS = ["time", "magnitude", "depth", "place"] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export const SORT_DIRECTIONS = ["asc", "desc"] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

export const DEFAULT_FILTERS: Filters = {
  feedMagnitude: "all",
  timeWindow: "day",
  minMagnitude: null,
  maxDepth: null,
  searchText: "",
  sortBy: "time",
  sortDir: "desc",
};

// URL parameter names — short and stable.
const PARAM = {
  feedMagnitude: "mag",
  timeWindow: "window",
  minMagnitude: "minMag",
  maxDepth: "maxDepth",
  searchText: "q",
  sortBy: "sort",
  sortDir: "dir",
} as const;

/** Minimal read interface satisfied by both `URLSearchParams` and Next's readonly variant. */
export interface ReadonlySearchParams {
  get(name: string): string | null;
}

function parseEnum<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** Parse a non-negative finite number, or `null` if absent/invalid. */
function parseOptionalNumber(value: string | null, { min }: { min?: number } = {}): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (min !== undefined && parsed < min) return null;
  return parsed;
}

/**
 * Pure `searchParams → Filters`. Unknown/corrupt values silently fall back to
 * the corresponding default, so a hand-edited or stale URL can never break the
 * app.
 */
export function parseFilters(searchParams: ReadonlySearchParams): Filters {
  return {
    feedMagnitude: parseEnum(
      searchParams.get(PARAM.feedMagnitude),
      FEED_MAGNITUDES,
      DEFAULT_FILTERS.feedMagnitude,
    ),
    timeWindow: parseEnum(
      searchParams.get(PARAM.timeWindow),
      FEED_WINDOWS,
      DEFAULT_FILTERS.timeWindow,
    ),
    minMagnitude: parseOptionalNumber(searchParams.get(PARAM.minMagnitude)),
    maxDepth: parseOptionalNumber(searchParams.get(PARAM.maxDepth), { min: 0 }),
    searchText: searchParams.get(PARAM.searchText)?.trim() ?? DEFAULT_FILTERS.searchText,
    sortBy: parseEnum(searchParams.get(PARAM.sortBy), SORT_FIELDS, DEFAULT_FILTERS.sortBy),
    sortDir: parseEnum(searchParams.get(PARAM.sortDir), SORT_DIRECTIONS, DEFAULT_FILTERS.sortDir),
  };
}

/**
 * Pure `Filters → URLSearchParams`, omitting any field equal to its default so
 * the common case produces an empty (clean) query string.
 */
export function serializeFilters(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.feedMagnitude !== DEFAULT_FILTERS.feedMagnitude) {
    params.set(PARAM.feedMagnitude, filters.feedMagnitude);
  }
  if (filters.timeWindow !== DEFAULT_FILTERS.timeWindow) {
    params.set(PARAM.timeWindow, filters.timeWindow);
  }
  if (filters.minMagnitude !== null) {
    params.set(PARAM.minMagnitude, String(filters.minMagnitude));
  }
  if (filters.maxDepth !== null) {
    params.set(PARAM.maxDepth, String(filters.maxDepth));
  }
  if (filters.searchText !== DEFAULT_FILTERS.searchText) {
    params.set(PARAM.searchText, filters.searchText);
  }
  if (filters.sortBy !== DEFAULT_FILTERS.sortBy) {
    params.set(PARAM.sortBy, filters.sortBy);
  }
  if (filters.sortDir !== DEFAULT_FILTERS.sortDir) {
    params.set(PARAM.sortDir, filters.sortDir);
  }

  return params;
}

/** The USGS feed (file) selected by the current filters. */
export function feedFromFilters(filters: Filters): SummaryFeed {
  return { magnitude: filters.feedMagnitude, window: filters.timeWindow };
}
