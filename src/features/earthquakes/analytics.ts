import type { FeedWindow } from "./api";
import { magnitudeColor } from "./magnitude";
import type { EarthquakeEvent } from "./types";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export interface MagnitudeBin {
  /** Inclusive lower edge of the bin (e.g. 4.5 covers [4.5, 5.0)). */
  binStart: number;
  count: number;
  /** Color of the bin center, from the shared magnitude scale. */
  color: string;
}

/**
 * Histogram of event magnitudes in fixed-width bins (default 0.5).
 *
 * Pure and independent of Recharts. Events with unknown (`null`) magnitude are
 * excluded. Bins run contiguously from the lowest present magnitude (floored to
 * a bin edge) up to the highest, so gaps in the middle render as zero-height
 * bars rather than vanishing. Returns `[]` when there are no measured events.
 */
export function magnitudeHistogram(
  events: readonly EarthquakeEvent[],
  binSize = 0.5,
): MagnitudeBin[] {
  const magnitudes = events
    .map((event) => event.magnitude)
    .filter((magnitude): magnitude is number => magnitude !== null);

  if (magnitudes.length === 0) return [];

  const min = Math.floor(Math.min(...magnitudes) / binSize) * binSize;
  const counts = new Map<number, number>();
  let maxIndex = 0;

  for (const magnitude of magnitudes) {
    const index = Math.floor((magnitude - min) / binSize + 1e-9);
    counts.set(index, (counts.get(index) ?? 0) + 1);
    if (index > maxIndex) maxIndex = index;
  }

  const bins: MagnitudeBin[] = [];
  for (let index = 0; index <= maxIndex; index += 1) {
    const binStart = Number((min + index * binSize).toFixed(2));
    bins.push({
      binStart,
      count: counts.get(index) ?? 0,
      color: magnitudeColor(binStart + binSize / 2),
    });
  }
  return bins;
}

export type TimelineGranularity = "hour" | "day";

/** Bucket size for the frequency timeline given the feed window. */
export function timelineGranularity(window: FeedWindow): TimelineGranularity {
  return window === "hour" || window === "day" ? "hour" : "day";
}

export interface TimelinePoint {
  /** Bucket start, epoch ms (UTC-aligned to the hour or day). */
  bucketStart: number;
  count: number;
}

/**
 * Event frequency over time, bucketed by hour or day.
 *
 * Buckets are UTC-aligned and gap-filled from the first to the last populated
 * bucket, so the timeline is continuous (empty periods show as zero). Returns
 * `[]` for no events.
 */
export function frequencyTimeline(
  events: readonly EarthquakeEvent[],
  granularity: TimelineGranularity,
): TimelinePoint[] {
  if (events.length === 0) return [];

  const bucketMs = granularity === "hour" ? HOUR_MS : DAY_MS;
  const bucketOf = (time: number) => Math.floor(time / bucketMs) * bucketMs;

  const counts = new Map<number, number>();
  let min = Infinity;
  let max = -Infinity;

  for (const event of events) {
    const bucket = bucketOf(event.time.getTime());
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    if (bucket < min) min = bucket;
    if (bucket > max) max = bucket;
  }

  const points: TimelinePoint[] = [];
  for (let bucket = min; bucket <= max; bucket += bucketMs) {
    points.push({ bucketStart: bucket, count: counts.get(bucket) ?? 0 });
  }
  return points;
}
