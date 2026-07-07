import type { EarthquakeEvent } from "./types";

/**
 * Result of comparing two consecutive snapshots of the feed.
 *
 * - `added`   — events whose id was absent from the previous snapshot.
 * - `updated` — events present in both snapshots whose `updated` timestamp
 *               advanced. USGS revises magnitudes and locations retroactively
 *               (e.g. `automatic` → `reviewed`), so a re-seen id with a newer
 *               `updated` is a genuine change, not a duplicate.
 */
export interface EventDiff {
  added: EarthquakeEvent[];
  updated: EarthquakeEvent[];
}

/**
 * Pure diff between the previous and current feed snapshots.
 *
 * Kept free of React and I/O so it can be unit-tested in isolation and reused
 * verbatim on the server for the phase-2 SSE diffing route handler.
 *
 * Uses a `Map` keyed by event id for O(n + m) comparison rather than O(n·m)
 * nested scans. Output order follows `current`, so downstream consumers get a
 * stable, feed-ordered list.
 */
export function detectNewEvents(
  previous: readonly EarthquakeEvent[],
  current: readonly EarthquakeEvent[],
): EventDiff {
  const previousById = new Map<string, EarthquakeEvent>();
  for (const event of previous) {
    previousById.set(event.id, event);
  }

  const added: EarthquakeEvent[] = [];
  const updated: EarthquakeEvent[] = [];

  for (const event of current) {
    const prior = previousById.get(event.id);
    if (prior === undefined) {
      added.push(event);
    } else if (event.updated.getTime() > prior.updated.getTime()) {
      updated.push(event);
    }
  }

  return { added, updated };
}
