"use client";

import { useEffect, useState } from "react";
import { FEED_MAGNITUDES, FEED_WINDOWS, type FeedMagnitude, type FeedWindow } from "../api";
import type { Filters } from "../filters";

const SEARCH_DEBOUNCE_MS = 300;

const FEED_MAGNITUDE_LABELS: Record<FeedMagnitude, string> = {
  all: "All",
  "1.0": "M1.0+",
  "2.5": "M2.5+",
  "4.5": "M4.5+",
  significant: "Significant",
};

const WINDOW_LABELS: Record<FeedWindow, string> = {
  hour: "Past hour",
  day: "Past day",
  week: "Past week",
  month: "Past month",
};

export interface FilterToolbarProps {
  filters: Filters;
  onChange: (update: Partial<Filters>) => void;
}

const fieldClass =
  "rounded border border-border bg-surface-2 px-2 py-1 text-sm text-fg outline-none focus-visible:ring-1 focus-visible:ring-accent";

export function FilterToolbar({ filters, onChange }: FilterToolbarProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-border bg-surface-1 flex flex-wrap items-center gap-3 border-b px-4 py-2">
      {/* Always visible: feed + search */}
      <label className="text-fg-muted flex items-center gap-1.5 text-xs">
        Feed
        <select
          className={fieldClass}
          value={filters.feedMagnitude}
          onChange={(event) => onChange({ feedMagnitude: event.target.value as FeedMagnitude })}
          aria-label="Feed magnitude"
        >
          {FEED_MAGNITUDES.map((magnitude) => (
            <option key={magnitude} value={magnitude}>
              {FEED_MAGNITUDE_LABELS[magnitude]}
            </option>
          ))}
        </select>
        <select
          className={fieldClass}
          value={filters.timeWindow}
          onChange={(event) => onChange({ timeWindow: event.target.value as FeedWindow })}
          aria-label="Time window"
        >
          {FEED_WINDOWS.map((window) => (
            <option key={window} value={window}>
              {WINDOW_LABELS[window]}
            </option>
          ))}
        </select>
      </label>

      <SearchInput value={filters.searchText} onCommit={(searchText) => onChange({ searchText })} />

      {/* Collapsible on mobile: refinement filters */}
      <button
        type="button"
        className={`${fieldClass} sm:hidden`}
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? "Hide filters" : "More filters"}
      </button>

      <div className={`${expanded ? "flex" : "hidden"} flex-wrap items-center gap-3 sm:flex`}>
        <label className="text-fg-muted flex items-center gap-2 text-xs">
          Min magnitude
          <input
            type="range"
            min={0}
            max={8}
            step={0.5}
            value={filters.minMagnitude ?? 0}
            onChange={(event) => {
              const value = Number(event.target.value);
              onChange({ minMagnitude: value === 0 ? null : value });
            }}
            className="accent-accent"
            aria-label="Minimum magnitude"
          />
          <span className="text-fg w-8 tabular-nums">
            {filters.minMagnitude === null ? "Any" : filters.minMagnitude.toFixed(1)}
          </span>
        </label>

        <label className="text-fg-muted flex items-center gap-1.5 text-xs">
          Max depth (km)
          <input
            type="number"
            min={0}
            placeholder="Any"
            value={filters.maxDepth ?? ""}
            onChange={(event) => {
              const raw = event.target.value;
              const parsed = raw === "" ? null : Number(raw);
              onChange({ maxDepth: parsed !== null && Number.isFinite(parsed) ? parsed : null });
            }}
            className={`${fieldClass} w-20 tabular-nums`}
            aria-label="Maximum depth in kilometers"
          />
        </label>
      </div>
    </div>
  );
}

/**
 * Debounced text search. Keeps its own immediate local state for a responsive
 * input, but only commits to the URL 300ms after typing stops (the other
 * filters commit immediately — text is the only one debounced).
 */
function SearchInput({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const [text, setText] = useState(value);

  // Keep local state in sync when the URL value changes externally.
  useEffect(() => {
    setText(value);
  }, [value]);

  // Debounced commit.
  useEffect(() => {
    if (text === value) return;
    const id = setTimeout(() => onCommit(text), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [text, value, onCommit]);

  return (
    <div className="relative flex items-center">
      <span aria-hidden className="text-fg-muted pointer-events-none absolute left-2">
        ⌕
      </span>
      <input
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Search place…"
        aria-label="Search by place"
        className={`${fieldClass} w-40 pr-6 pl-6 sm:w-52`}
      />
      {text !== "" ? (
        <button
          type="button"
          onClick={() => {
            setText("");
            onCommit("");
          }}
          aria-label="Clear search"
          className="text-fg-muted hover:text-fg absolute right-2"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}
