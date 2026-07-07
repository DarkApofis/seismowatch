import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchEarthquakes, type SummaryFeed } from "../api";
import { deriveConnectionStatus, POLL_INTERVAL_MS, useEarthquakes } from "../hooks/useEarthquakes";
import { err, ok } from "@/lib/result";
import { makeEvent } from "./fixtures";

// The hook's only I/O dependency; everything else under test is pure React glue.
vi.mock("../api", () => ({ fetchEarthquakes: vi.fn() }));

const mockFetch = vi.mocked(fetchEarthquakes);
const feed: SummaryFeed = { magnitude: "all", window: "hour" };

function createWrapper() {
  // Disable retries so a failed fetch surfaces immediately instead of backing
  // off — the retry/backoff policy is a provider concern tested elsewhere.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

describe("deriveConnectionStatus", () => {
  const now = 1_000_000_000_000;

  it("is 'live' right after a successful fetch", () => {
    expect(deriveConnectionStatus({ lastUpdatedAt: new Date(now), hasError: false, now })).toBe(
      "live",
    );
  });

  it("is 'retrying' when a fetch is failing but data is still fresh", () => {
    expect(
      deriveConnectionStatus({ lastUpdatedAt: new Date(now - 1000), hasError: true, now }),
    ).toBe("retrying");
  });

  it("is 'stale' once the last success is older than 3 intervals", () => {
    const lastUpdatedAt = new Date(now - POLL_INTERVAL_MS * 3 - 1);
    expect(deriveConnectionStatus({ lastUpdatedAt, hasError: false, now })).toBe("stale");
  });

  it("prefers 'stale' over 'retrying' when data is both old and failing", () => {
    const lastUpdatedAt = new Date(now - POLL_INTERVAL_MS * 4);
    expect(deriveConnectionStatus({ lastUpdatedAt, hasError: true, now })).toBe("stale");
  });

  it("is 'retrying' when there is no data yet and a fetch failed", () => {
    expect(deriveConnectionStatus({ lastUpdatedAt: null, hasError: true, now })).toBe("retrying");
  });
});

describe("useEarthquakes", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("exposes normalized events after a successful fetch", async () => {
    mockFetch.mockResolvedValue(ok([makeEvent({ id: "a" })]));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useEarthquakes(feed), { wrapper });

    await waitFor(() => expect(result.current.events).toHaveLength(1));
    expect(result.current.error).toBeNull();
    expect(result.current.lastUpdatedAt).toBeInstanceOf(Date);
    expect(result.current.connectionStatus).toBe("live");
  });

  it("keeps previous data visible when a refetch fails (stale-while-error)", async () => {
    const initial = makeEvent({ id: "a" });
    mockFetch.mockResolvedValueOnce(ok([initial]));
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useEarthquakes(feed), { wrapper });
    await waitFor(() => expect(result.current.events).toHaveLength(1));

    // Next poll fails.
    mockFetch.mockResolvedValueOnce(err({ kind: "network", message: "offline" }));
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ["earthquakes"] });
    });

    await waitFor(() => expect(result.current.error).not.toBeNull());
    // Old data survives...
    expect(result.current.events).toEqual([initial]);
    // ...and the typed error is reported alongside it.
    expect(result.current.error?.kind).toBe("network");
    expect(result.current.connectionStatus).toBe("retrying");
  });

  it("clears the error once a later fetch succeeds again", async () => {
    mockFetch.mockResolvedValueOnce(ok([makeEvent({ id: "a" })]));
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useEarthquakes(feed), { wrapper });
    await waitFor(() => expect(result.current.events).toHaveLength(1));

    mockFetch.mockResolvedValueOnce(err({ kind: "http", message: "503", status: 503 }));
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ["earthquakes"] });
    });
    await waitFor(() => expect(result.current.error).not.toBeNull());

    mockFetch.mockResolvedValueOnce(ok([makeEvent({ id: "a" }), makeEvent({ id: "b" })]));
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ["earthquakes"] });
    });

    await waitFor(() => expect(result.current.events).toHaveLength(2));
    expect(result.current.error).toBeNull();
    expect(result.current.connectionStatus).toBe("live");
  });
});
