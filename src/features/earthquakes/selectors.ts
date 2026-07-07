import type { Filters, SortDirection, SortField } from "./filters";
import type { EarthquakeEvent } from "./types";

/**
 * Pure client-side filtering. Applied on top of the server-selected feed:
 *  - `minMagnitude` — keep events at/above the bound. Events with unknown
 *    (`null`) magnitude are dropped once a bound is set (they can't be shown to
 *    satisfy it).
 *  - `maxDepth` — keep events at/below the depth bound.
 *  - `searchText` — case-insensitive substring match against `place`.
 *
 * A `null`/empty filter field is a no-op, so the default filters return the
 * input unchanged (order preserved).
 */
export function filterEvents(
  events: readonly EarthquakeEvent[],
  filters: Filters,
): EarthquakeEvent[] {
  const { minMagnitude, maxDepth, searchText } = filters;
  const needle = searchText.trim().toLowerCase();

  return events.filter((event) => {
    if (minMagnitude !== null) {
      if (event.magnitude === null || event.magnitude < minMagnitude) return false;
    }
    if (maxDepth !== null && event.depth > maxDepth) {
      return false;
    }
    if (needle !== "" && !(event.place ?? "").toLowerCase().includes(needle)) {
      return false;
    }
    return true;
  });
}

/** Comparator building block: pushes `null` values to the end regardless of direction. */
function compareNullable(a: number | null, b: number | null, direction: SortDirection): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1; // nulls always last
  if (b === null) return -1;
  return direction === "asc" ? a - b : b - a;
}

function compareStrings(a: string, b: string, direction: SortDirection): number {
  const result = a.localeCompare(b);
  return direction === "asc" ? result : -result;
}

/**
 * Pure, stable sort. Returns a new array; the input is not mutated.
 *
 * Stability: `Array.prototype.sort` is stable in modern engines, and every
 * comparator returns `0` only for genuinely-equal keys, so events that tie on
 * the sort key keep their prior (feed) order. Magnitude (nullable) sorts
 * `null` last in both directions — unknown magnitudes shouldn't masquerade as
 * the strongest or weakest.
 */
export function sortEvents(
  events: readonly EarthquakeEvent[],
  sortBy: SortField,
  sortDir: SortDirection,
): EarthquakeEvent[] {
  const sorted = [...events];

  sorted.sort((a, b) => {
    switch (sortBy) {
      case "time":
        return sortDir === "asc"
          ? a.time.getTime() - b.time.getTime()
          : b.time.getTime() - a.time.getTime();
      case "magnitude":
        return compareNullable(a.magnitude, b.magnitude, sortDir);
      case "depth":
        return sortDir === "asc" ? a.depth - b.depth : b.depth - a.depth;
      case "place":
        return compareStrings(a.place ?? "", b.place ?? "", sortDir);
      default:
        return 0;
    }
  });

  return sorted;
}
