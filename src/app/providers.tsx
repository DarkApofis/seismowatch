"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, type ReactNode } from "react";
import { POLL_INTERVAL_MS } from "@/features/earthquakes/hooks/useEarthquakes";

/**
 * App-wide TanStack Query provider.
 *
 * The client is created lazily in state so it survives re-renders but is never
 * shared across requests on the server (each browser session gets its own).
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data stays "fresh" for exactly one polling interval, so multiple
            // components reading the same feed within a cycle share one fetch
            // instead of each triggering their own.
            staleTime: POLL_INTERVAL_MS,
            // Keep unused feed data around for a few cycles before GC, so
            // switching feeds back and forth doesn't refetch from scratch.
            gcTime: POLL_INTERVAL_MS * 5,
            retry: 3,
            // Exponential backoff (1s, 2s, 4s, …) capped at 30s so a flaky
            // network doesn't hammer the USGS endpoint.
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
            // Seismic activity is continuous and the feed updates constantly;
            // when the user refocuses the tab we want the freshest events at
            // once rather than waiting up to a full interval for the next poll.
            refetchOnWindowFocus: true,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
