"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchEarthquakes, type SummaryFeed } from "../api";
import type { FetchError } from "../errors";
import type { EarthquakeEvent } from "../types";

/** Polling cadence. Kept here so the provider's `staleTime` can align to it. */
export const POLL_INTERVAL_MS = 60_000;

/**
 * Number of missed intervals after which the connection is considered `stale`.
 * Three failed polls (~3 minutes) is a comfortable margin over transient blips.
 */
export const STALE_INTERVAL_MULTIPLIER = 3;

export type ConnectionStatus = "live" | "retrying" | "stale";

/**
 * Pure derivation of the connection status. Extracted from the hook so it can
 * be reasoned about and tested without React or timers.
 *
 * - `stale`   — the last *successful* fetch is older than N polling intervals,
 *               so what we're showing can no longer be trusted as current.
 * - `retrying`— a fetch is currently failing but recent data is still fresh.
 * - `live`    — everything is up to date.
 *
 * Staleness wins over `retrying`: once data is genuinely old, that it's also
 * mid-retry is secondary — the user needs to know the view is out of date.
 */
export function deriveConnectionStatus(args: {
  lastUpdatedAt: Date | null;
  hasError: boolean;
  now: number;
  intervalMs?: number;
}): ConnectionStatus {
  const { lastUpdatedAt, hasError, now, intervalMs = POLL_INTERVAL_MS } = args;

  if (
    lastUpdatedAt !== null &&
    now - lastUpdatedAt.getTime() > intervalMs * STALE_INTERVAL_MULTIPLIER
  ) {
    return "stale";
  }
  if (hasError) {
    return "retrying";
  }
  return "live";
}

export interface UseEarthquakesResult {
  /** Latest successful snapshot; retained across failed refetches. */
  events: EarthquakeEvent[];
  /** True only on the very first load, before any data exists. */
  isInitialLoading: boolean;
  /** True whenever a fetch (initial or background poll) is in flight. */
  isFetching: boolean;
  /** Timestamp of the last successful fetch, or `null` if none yet. */
  lastUpdatedAt: Date | null;
  /** The current fetch error, if the most recent attempt failed. */
  error: FetchError | null;
  connectionStatus: ConnectionStatus;
  /** Manually trigger a refetch (e.g. a "retry" button after a failure). */
  refetch: () => void;
}

/**
 * Polls a USGS summary feed every {@link POLL_INTERVAL_MS} and exposes the
 * normalized events plus a derived connection status.
 *
 * Stale-while-error: the query function throws the `FetchError` carried by the
 * `Result` from {@link fetchEarthquakes}. TanStack Query retains the last
 * successful `data` when a background refetch throws, so `events` stays visible
 * while `error` reports the failure separately — the UI never blanks out on a
 * transient network hiccup.
 *
 * Retry/backoff and `refetchOnWindowFocus` are configured once as provider
 * defaults; this hook only owns the feed-specific polling interval.
 */
export function useEarthquakes(feed: SummaryFeed): UseEarthquakesResult {
  const query = useQuery<EarthquakeEvent[], FetchError>({
    queryKey: ["earthquakes", feed.magnitude, feed.window],
    queryFn: async ({ signal }) => {
      const result = await fetchEarthquakes(feed, { signal });
      if (!result.ok) {
        throw result.error;
      }
      return result.value;
    },
    refetchInterval: POLL_INTERVAL_MS,
  });

  const lastUpdatedAt = query.dataUpdatedAt > 0 ? new Date(query.dataUpdatedAt) : null;

  return {
    events: query.data ?? [],
    isInitialLoading: query.isLoading,
    isFetching: query.isFetching,
    lastUpdatedAt,
    error: query.error ?? null,
    connectionStatus: deriveConnectionStatus({
      lastUpdatedAt,
      hasError: query.isError,
      now: Date.now(),
    }),
    refetch: () => {
      void query.refetch();
    },
  };
}
