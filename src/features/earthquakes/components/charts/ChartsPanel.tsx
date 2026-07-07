"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { FeedWindow } from "../../api";
import type { EarthquakeEvent } from "../../types";

// Recharts is heavy (~40kB gzip). The panel is collapsed by default, so the
// charts — and Recharts with them — are lazy-loaded on first expand, keeping
// them out of the initial page bundle.
const chartLoading = () => <div className="bg-surface-2/40 h-[180px] animate-pulse rounded" />;

const MagnitudeHistogram = dynamic(
  () => import("./MagnitudeHistogram").then((m) => m.MagnitudeHistogram),
  { ssr: false, loading: chartLoading },
);
const FrequencyTimeline = dynamic(
  () => import("./FrequencyTimeline").then((m) => m.FrequencyTimeline),
  { ssr: false, loading: chartLoading },
);

/**
 * Collapsible analytics section, placed between the metric cards and the map.
 *
 * A collapsible strip (rather than a permanent side panel) keeps the map
 * dominant on the common layout; both charts read the same filtered `events`
 * the map and table use, so they update together. The charts are code-split so
 * Recharts loads only when someone opens the panel.
 */
export function ChartsPanel({
  events,
  timeWindow,
}: {
  events: readonly EarthquakeEvent[];
  timeWindow: FeedWindow;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="border-border bg-surface-1 border-b">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="text-fg-muted hover:text-fg flex w-full items-center gap-2 px-5 py-2 text-xs font-medium tracking-wide uppercase"
      >
        <span aria-hidden>{open ? "▾" : "▸"}</span>
        Analytics
      </button>

      {open ? (
        <div className="grid grid-cols-1 gap-4 px-4 pb-4 md:grid-cols-2">
          <figure>
            <figcaption className="text-fg-muted mb-1 px-1 text-xs">
              Magnitude distribution
            </figcaption>
            <MagnitudeHistogram events={events} />
          </figure>
          <figure>
            <figcaption className="text-fg-muted mb-1 px-1 text-xs">Event frequency</figcaption>
            <FrequencyTimeline events={events} timeWindow={timeWindow} />
          </figure>
        </div>
      ) : null}
    </section>
  );
}
