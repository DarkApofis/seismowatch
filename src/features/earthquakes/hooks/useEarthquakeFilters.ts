"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { type Filters, parseFilters, serializeFilters } from "../filters";

export interface UseEarthquakeFiltersResult {
  filters: Filters;
  /** Merge a partial update (or map the current filters) and write to the URL. */
  setFilters: (update: Partial<Filters> | ((current: Filters) => Filters)) => void;
}

/**
 * Filter state backed entirely by the URL query string.
 *
 * Why URL-as-state rather than a client store (Zustand/Redux/Context):
 *  - It makes every view **shareable** and **bookmarkable**, and it survives a
 *    refresh or back/forward navigation for free.
 *  - There is no client state here that isn't derivable from `URL + server
 *    data` — the events come from TanStack Query, and the filters describe how
 *    to view them. A separate store would just be a second source of truth to
 *    keep in sync with the URL.
 *
 * Writes use `router.replace` with `scroll: false` so tweaking a filter doesn't
 * spam browser history or jump the scroll position. Parsing/serialization are
 * the pure functions in `filters.ts`; this hook is only the Next.js glue.
 */
export function useEarthquakeFilters(): UseEarthquakeFiltersResult {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);

  const setFilters = useCallback(
    (update: Partial<Filters> | ((current: Filters) => Filters)) => {
      // Re-parse rather than closing over `filters` so rapid successive updates
      // always build on the latest URL, not a stale render's snapshot.
      const current = parseFilters(searchParams);
      const next = typeof update === "function" ? update(current) : { ...current, ...update };
      const query = serializeFilters(next).toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  return { filters, setFilters };
}
