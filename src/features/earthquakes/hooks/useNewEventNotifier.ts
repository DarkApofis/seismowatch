"use client";

import { useEffect, useRef, useState } from "react";
import { detectNewEvents, type EventDiff } from "../diff";
import type { EarthquakeEvent } from "../types";

export interface UseNewEventNotifierOptions {
  /**
   * Called once per polling cycle that produces new or updated events. Memoize
   * it (e.g. `useCallback`) if identity stability matters to the caller; an
   * unstable callback is harmless here (it only re-runs the effect against an
   * unchanged snapshot, which diffs to nothing).
   */
  onNewEvents?: (diff: EventDiff) => void;
  /**
   * Opaque key identifying the current data source (e.g. the feed). When it
   * changes, the previous snapshot is discarded and a fresh silent baseline is
   * adopted — otherwise switching feeds would diff feed A against feed B and
   * report the entire new feed as "new".
   */
  resetKey?: string;
}

/**
 * Detects events that appeared or were revised between consecutive snapshots.
 *
 * The previous snapshot is held in a ref so the diff runs against the last
 * *rendered* feed without making that snapshot part of React state.
 *
 * Baseline handling avoids spurious bursts in two cases:
 *  - **Initial load / feed switch:** while the query is still resolving, the
 *    snapshot is empty. The first *non-empty* snapshot is adopted as a silent
 *    baseline, so the arrival of the initial batch never fires notifications.
 *  - **`resetKey` change:** discards the old baseline and re-settles on the new
 *    source's first batch.
 *
 * All comparison logic lives in the pure {@link detectNewEvents}; this hook is
 * only the React glue. The phase-2 SSE route handler will call the same pure
 * function server-side, so the notion of "new" stays identical on both sides.
 */
export function useNewEventNotifier(
  events: readonly EarthquakeEvent[],
  options: UseNewEventNotifierOptions = {},
): EventDiff {
  const { onNewEvents, resetKey } = options;
  const previousRef = useRef<readonly EarthquakeEvent[] | null>(null);
  const resetKeyRef = useRef<string | undefined>(resetKey);
  // True until the first non-empty snapshot of the current source is baselined.
  const settlingRef = useRef(true);
  const [lastDiff, setLastDiff] = useState<EventDiff>({ added: [], updated: [] });

  useEffect(() => {
    // Source changed → drop the old baseline and re-settle.
    if (resetKeyRef.current !== resetKey) {
      resetKeyRef.current = resetKey;
      previousRef.current = events;
      settlingRef.current = events.length === 0;
      setLastDiff({ added: [], updated: [] });
      return;
    }

    const previous = previousRef.current;
    previousRef.current = events;

    // Adopt the first non-empty snapshot as a silent baseline.
    if (settlingRef.current || previous === null) {
      if (events.length > 0) settlingRef.current = false;
      return;
    }

    const diff = detectNewEvents(previous, events);
    if (diff.added.length === 0 && diff.updated.length === 0) {
      return;
    }

    setLastDiff(diff);
    onNewEvents?.(diff);
  }, [events, onNewEvents, resetKey]);

  return lastDiff;
}
