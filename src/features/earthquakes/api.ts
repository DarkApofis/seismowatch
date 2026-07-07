import { err, ok, type Result } from "@/lib/result";
import type { FetchError } from "./errors";
import { toEarthquakeEvent } from "./transform";
import type { EarthquakeEvent, UsgsFeatureCollection } from "./types";

/**
 * Base URL of the USGS summary feed. Each feed is `{magnitude}_{window}.geojson`.
 * https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/
 */
const SUMMARY_FEED_BASE_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary" as const;

/** Magnitude bands offered by the summary feed. */
export const FEED_MAGNITUDES = ["all", "1.0", "2.5", "4.5", "significant"] as const;
export type FeedMagnitude = (typeof FEED_MAGNITUDES)[number];

/** Time windows offered by the summary feed. */
export const FEED_WINDOWS = ["hour", "day", "week", "month"] as const;
export type FeedWindow = (typeof FEED_WINDOWS)[number];

/**
 * A summary feed is a (magnitude, window) pair. Not every combination is
 * published by USGS — `significant` only exists for `hour`, `day`, `week`,
 * `month`, and `all`/`1.0` are not published for `hour` in the same way — but
 * the type keeps the two axes explicit and the constant map below only lists
 * combinations we actually use.
 */
export interface SummaryFeed {
  magnitude: FeedMagnitude;
  window: FeedWindow;
}

/** Build the canonical URL for a summary feed. */
export function summaryFeedUrl({ magnitude, window }: SummaryFeed): string {
  return `${SUMMARY_FEED_BASE_URL}/${magnitude}_${window}.geojson`;
}

/**
 * Curated, ready-to-use feeds. These are the combinations the dashboard polls;
 * the `SummaryFeed` type still allows any pairing for ad-hoc use.
 */
export const FEEDS = {
  significantWeek: { magnitude: "significant", window: "week" },
  significantMonth: { magnitude: "significant", window: "month" },
  m45Day: { magnitude: "4.5", window: "day" },
  m25Day: { magnitude: "2.5", window: "day" },
  allHour: { magnitude: "all", window: "hour" },
  allDay: { magnitude: "all", window: "day" },
} as const satisfies Record<string, SummaryFeed>;

export type FeedKey = keyof typeof FEEDS;

/**
 * Fetch and normalize a summary feed.
 *
 * Error strategy: this returns a `Result` instead of throwing. Rationale — the
 * feed is polled every 60s, so transient network blips and non-200 responses
 * are *expected* and must be handled by the caller (retry, keep stale data,
 * show a banner) rather than crashing a render or unwinding the stack. Reserved
 * exceptions (e.g. `InvalidGeometryError`) stay for genuine data-integrity bugs
 * and are surfaced here as a `parse` error so a single bad record can't take
 * down the whole poll.
 */
export async function fetchEarthquakes(
  feed: SummaryFeed,
  init?: RequestInit,
): Promise<Result<EarthquakeEvent[], FetchError>> {
  let response: Response;
  try {
    response = await fetch(summaryFeedUrl(feed), init);
  } catch (cause) {
    return err({
      kind: "network",
      message: "Failed to reach the USGS feed",
      cause,
    });
  }

  if (!response.ok) {
    return err({
      kind: "http",
      message: `USGS feed responded with ${response.status} ${response.statusText}`,
      status: response.status,
    });
  }

  try {
    const collection = (await response.json()) as UsgsFeatureCollection;
    const events = collection.features.map(toEarthquakeEvent);
    return ok(events);
  } catch (cause) {
    return err({
      kind: "parse",
      message: "Failed to parse or normalize the USGS feed payload",
      cause,
    });
  }
}
