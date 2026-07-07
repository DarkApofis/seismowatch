"use client";

import dynamic from "next/dynamic";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AlertsPanel } from "@/features/alerts/components/AlertsPanel";
import { AlertToasts } from "@/features/alerts/components/AlertToasts";
import { useAlertDispatcher } from "@/features/alerts/hooks/useAlertDispatcher";
import { useAlertRules } from "@/features/alerts/hooks/useAlertRules";
import { useNotificationPermission } from "@/features/alerts/hooks/useNotificationPermission";
import type { BoundingBox } from "@/features/alerts/types";
import { ChartsPanel } from "@/features/earthquakes/components/charts/ChartsPanel";
import { EarthquakeTable } from "@/features/earthquakes/components/EarthquakeTable";
import { FilterToolbar } from "@/features/earthquakes/components/FilterToolbar";
import { DEFAULT_FILTERS, feedFromFilters, type Filters } from "@/features/earthquakes/filters";
import { useEarthquakeFilters } from "@/features/earthquakes/hooks/useEarthquakeFilters";
import { useEarthquakes, type ConnectionStatus } from "@/features/earthquakes/hooks/useEarthquakes";
import { useNewEventNotifier } from "@/features/earthquakes/hooks/useNewEventNotifier";
import { filterEvents, sortEvents } from "@/features/earthquakes/selectors";
import type { EarthquakeEvent } from "@/features/earthquakes/types";
import { formatRelativeTime } from "@/lib/relativeTime";

const HOUR_MS = 3_600_000;
const WINDOW_MS: Record<Filters["timeWindow"], number> = {
  hour: HOUR_MS,
  day: 24 * HOUR_MS,
  week: 7 * 24 * HOUR_MS,
  month: 30 * 24 * HOUR_MS,
};

// MapLibre is client-only; load it with ssr:false (allowed from a client page).
const EarthquakeMap = dynamic(
  () => import("@/features/earthquakes/components/EarthquakeMap").then((m) => m.EarthquakeMap),
  {
    ssr: false,
    loading: () => (
      <div className="text-fg-muted grid h-full place-items-center text-sm">Loading map…</div>
    ),
  },
);

interface FeedStats {
  count: number;
  strongest: EarthquakeEvent | null;
  mostRecent: EarthquakeEvent | null;
}

function computeStats(events: readonly EarthquakeEvent[]): FeedStats {
  let strongest: EarthquakeEvent | null = null;
  let mostRecent: EarthquakeEvent | null = null;

  for (const event of events) {
    if (
      event.magnitude !== null &&
      (strongest?.magnitude == null || event.magnitude > strongest.magnitude)
    ) {
      strongest = event;
    }
    if (mostRecent === null || event.time.getTime() > mostRecent.time.getTime()) {
      mostRecent = event;
    }
  }

  return { count: events.length, strongest, mostRecent };
}

// `useSearchParams` requires a Suspense boundary; the whole dashboard reads it.
export default function HomePage() {
  return (
    <Suspense
      fallback={<div className="text-fg-muted grid h-[100dvh] place-items-center">Loading…</div>}
    >
      <Dashboard />
    </Suspense>
  );
}

function Dashboard() {
  const { filters, setFilters } = useEarthquakeFilters();
  const feed = useMemo(() => feedFromFilters(filters), [filters]);
  const feedKey = `${filters.feedMagnitude}_${filters.timeWindow}`;

  const { events, isInitialLoading, lastUpdatedAt, connectionStatus, error, refetch } =
    useEarthquakes(feed);

  // New-event detection runs on the RAW feed (not the filtered view) and resets
  // its baseline when the feed changes, so switching feeds never floods pulses.
  const newDiff = useNewEventNotifier(events, { resetKey: feedKey });

  // Single filtered+sorted array — consumed by BOTH the map and the table.
  const visible = useMemo(
    () => sortEvents(filterEvents(events, filters), filters.sortBy, filters.sortDir),
    [events, filters],
  );
  const stats = useMemo(() => computeStats(visible), [visible]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedEvent = useMemo(
    () => (selectedId ? (events.find((event) => event.id === selectedId) ?? null) : null),
    [events, selectedId],
  );

  const handleSelect = useCallback((event: EarthquakeEvent | null) => {
    setSelectedId(event?.id ?? null);
  }, []);
  const handleTableSelect = useCallback((event: EarthquakeEvent) => {
    setSelectedId(event.id);
  }, []);
  const handleSortChange = useCallback(
    (sortBy: Filters["sortBy"], sortDir: Filters["sortDir"]) => setFilters({ sortBy, sortDir }),
    [setFilters],
  );
  const handleFilterChange = useCallback(
    (update: Partial<Filters>) => setFilters(update),
    [setFilters],
  );
  const handleClearFilters = useCallback(() => {
    setFilters({
      minMagnitude: DEFAULT_FILTERS.minMagnitude,
      maxDepth: DEFAULT_FILTERS.maxDepth,
      searchText: DEFAULT_FILTERS.searchText,
    });
  }, [setFilters]);

  const hasClientFilters =
    filters.minMagnitude !== null || filters.maxDepth !== null || filters.searchText !== "";

  // Alerts: rules (persisted) + permission + dispatcher over new events.
  const { rules, addRule, removeRule, toggleRule } = useAlertRules();
  const { permission, request } = useNotificationPermission();
  const [mapBounds, setMapBounds] = useState<BoundingBox | null>(null);
  const { toasts, dismiss } = useAlertDispatcher({
    newEvents: newDiff.added,
    rules,
    permission,
    onSelect: handleTableSelect,
  });

  const [tab, setTab] = useState<"map" | "list">("map");

  return (
    <div className="bg-surface-0 flex h-[100dvh] flex-col">
      <Header
        status={connectionStatus}
        lastUpdatedAt={lastUpdatedAt}
        feedLabel={feedKey}
        alerts={
          <AlertsPanel
            rules={rules}
            permission={permission}
            onRequestPermission={request}
            onAdd={addRule}
            onToggle={toggleRule}
            onRemove={removeRule}
            currentBounds={mapBounds}
          />
        }
      />
      {error ? <ErrorBanner message={error.message} onRetry={refetch} /> : null}
      <MetricRow stats={stats} loading={isInitialLoading} />
      <ChartsPanel events={visible} timeWindow={filters.timeWindow} />

      <div className="flex min-h-0 flex-1 flex-col">
        {/* Mobile-only tabs (layout only; both regions stay mounted) */}
        <div className="border-border flex border-b sm:hidden" role="tablist">
          <TabButton active={tab === "map"} onClick={() => setTab("map")}>
            Map
          </TabButton>
          <TabButton active={tab === "list"} onClick={() => setTab("list")}>
            List
          </TabButton>
        </div>

        {/* Map region */}
        <div
          className={`relative min-h-0 sm:h-[58vh] ${
            tab === "map" ? "flex-1 sm:flex-none" : "hidden sm:block"
          }`}
        >
          <EarthquakeMap
            events={visible}
            newEvents={newDiff.added}
            selectedEvent={selectedEvent}
            onSelect={handleSelect}
            onBoundsChange={setMapBounds}
            windowMs={WINDOW_MS[filters.timeWindow]}
          />
        </div>

        {/* Table region with sticky toolbar */}
        <div
          className={`min-h-0 flex-col ${tab === "list" ? "flex flex-1" : "hidden"} sm:flex sm:flex-1`}
        >
          <div className="sticky top-0 z-10">
            <FilterToolbar filters={filters} onChange={handleFilterChange} />
          </div>
          <div className="min-h-0 flex-1">
            <EarthquakeTable
              events={visible}
              sortBy={filters.sortBy}
              sortDir={filters.sortDir}
              onSortChange={handleSortChange}
              selectedId={selectedId}
              onSelect={handleTableSelect}
              onClearFilters={hasClientFilters ? handleClearFilters : undefined}
            />
          </div>
        </div>
      </div>

      <AlertToasts
        toasts={toasts}
        onDismiss={dismiss}
        onSelect={(toast) => setSelectedId(toast.event.id)}
      />
    </div>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 border-b border-red-900/60 bg-red-950/50 px-5 py-2 text-sm text-red-200"
    >
      <span>Live updates interrupted: {message}. Showing the last known data.</span>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 rounded border border-red-700 px-2 py-0.5 text-xs text-red-100 hover:bg-red-900/50"
      >
        Retry
      </button>
    </div>
  );
}

function Header({
  status,
  lastUpdatedAt,
  feedLabel,
  alerts,
}: {
  status: ConnectionStatus;
  lastUpdatedAt: Date | null;
  feedLabel: string;
  alerts: React.ReactNode;
}) {
  return (
    <header className="border-border bg-surface-1 flex items-center justify-between border-b px-5 py-3">
      <div className="flex items-baseline gap-2">
        <h1 className="text-fg text-base font-semibold tracking-tight">SeismoWatch</h1>
        <span className="text-fg-muted hidden text-xs sm:inline">USGS · {feedLabel}</span>
      </div>
      <div className="flex items-center gap-4 text-xs">
        {alerts}
        <ConnectionIndicator status={status} />
        <span className="text-fg-muted">
          Updated {lastUpdatedAt ? <RelativeTime date={lastUpdatedAt} /> : "—"}
        </span>
      </div>
    </header>
  );
}

const STATUS_META: Record<ConnectionStatus, { label: string; dot: string; live: boolean }> = {
  live: { label: "Live", dot: "bg-green-500", live: true },
  retrying: { label: "Retrying", dot: "bg-amber-500", live: false },
  stale: { label: "Stale", dot: "bg-neutral-500", live: false },
};

function ConnectionIndicator({ status }: { status: ConnectionStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`h-2 w-2 rounded-full ${meta.dot} ${meta.live ? "animate-pulse" : ""}`}
        aria-hidden
      />
      <span className="text-fg-secondary">{meta.label}</span>
    </span>
  );
}

function MetricRow({ stats, loading }: { stats: FeedStats; loading: boolean }) {
  const { count, strongest, mostRecent } = stats;
  return (
    <div className="border-border bg-border grid grid-cols-1 gap-px border-b sm:grid-cols-3">
      <MetricCard label="Events (filtered)" value={loading ? "…" : count.toLocaleString()} />
      <MetricCard
        label="Strongest"
        value={strongest?.magnitude != null ? `M ${strongest.magnitude.toFixed(1)}` : "—"}
        sub={strongest?.place ?? undefined}
      />
      <MetricCard
        label="Most recent"
        value={mostRecent ? <RelativeTime date={mostRecent.time} /> : "—"}
        sub={mostRecent?.title}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="bg-surface-1 px-5 py-3">
      <p className="text-fg-muted text-xs tracking-wide uppercase">{label}</p>
      <p className="text-fg mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
      {sub ? <p className="text-fg-secondary mt-0.5 truncate text-xs">{sub}</p> : null}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex-1 py-2 text-sm font-medium ${
        active ? "border-accent text-fg border-b-2" : "text-fg-muted"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Self-ticking relative timestamp. Owns its own 1s interval so only this small
 * node re-renders each second — the map and table never re-render on the tick.
 */
function RelativeTime({ date }: { date: Date }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="tabular-nums">{formatRelativeTime(date, now)}</span>;
}
