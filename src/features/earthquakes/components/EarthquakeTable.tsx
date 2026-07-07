"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useMemo, useRef, useState } from "react";
import { formatRelativeTime } from "@/lib/relativeTime";
import { SORT_FIELDS, type SortDirection, type SortField } from "../filters";
import { magnitudeColor } from "../magnitude";
import type { EarthquakeEvent } from "../types";

const ROW_HEIGHT = 44;
// Shared column widths for the header and every row so they stay aligned.
const GRID_TEMPLATE = "minmax(120px,1fr) 68px minmax(160px,2.5fr) 84px 52px";

export interface EarthquakeTableProps {
  /** Already filtered AND sorted upstream — the table renders rows as given. */
  events: EarthquakeEvent[];
  sortBy: SortField;
  sortDir: SortDirection;
  onSortChange: (sortBy: SortField, sortDir: SortDirection) => void;
  selectedId: string | null;
  onSelect: (event: EarthquakeEvent) => void;
  /** Shown in the empty state when client filters are hiding everything. */
  onClearFilters?: () => void;
}

const columnHelper = createColumnHelper<EarthquakeEvent>();

const columns = [
  columnHelper.display({
    id: "time",
    header: "Time",
    cell: ({ row }) => <TimeCell event={row.original} />,
  }),
  columnHelper.display({
    id: "magnitude",
    header: "Mag",
    cell: ({ row }) => <MagnitudeBadge magnitude={row.original.magnitude} />,
  }),
  columnHelper.display({
    id: "place",
    header: "Place",
    cell: ({ row }) => <span className="text-fg truncate">{row.original.place ?? "—"}</span>,
  }),
  columnHelper.display({
    id: "depth",
    header: "Depth",
    cell: ({ row }) => (
      <span className="text-fg-secondary tabular-nums">{row.original.depth.toFixed(0)} km</span>
    ),
  }),
  columnHelper.display({
    id: "link",
    header: "",
    cell: ({ row }) => <UsgsLink url={row.original.url} title={row.original.title} />,
  }),
];

const HEADER_LABELS: Record<string, string> = {
  time: "Time",
  magnitude: "Mag",
  place: "Place",
  depth: "Depth",
  link: "",
};

function isSortField(id: string): id is SortField {
  return (SORT_FIELDS as readonly string[]).includes(id);
}

/**
 * Virtualized events table.
 *
 * TanStack Table (headless) owns the column/row model; TanStack Virtual renders
 * only the rows in (and just around) the viewport. With the monthly feed's
 * ~10k events, this keeps the DOM at ~20–30 row nodes instead of 10k, which is
 * the difference between a smooth scroll and a frozen tab.
 *
 * Sorting is *not* handled by the table's own model — the sort key lives in the
 * URL and the parent re-sorts the data (single source of truth). Header clicks
 * just write the new sort to the URL; the rows arrive already ordered.
 */
export function EarthquakeTable({
  events,
  sortBy,
  sortDir,
  onSortChange,
  selectedId,
  onSelect,
  onClearFilters,
}: EarthquakeTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  // Roving tabindex: exactly one row is tabbable at a time.
  const [activeIndex, setActiveIndex] = useState(0);

  const table = useReactTable({
    data: events,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (event) => event.id,
  });
  const rows = table.getRowModel().rows;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });
  const virtualRows = virtualizer.getVirtualItems();

  const handleSort = useCallback(
    (field: SortField) => {
      const nextDir: SortDirection =
        sortBy === field
          ? sortDir === "asc"
            ? "desc"
            : "asc"
          : field === "place"
            ? "asc"
            : "desc";
      onSortChange(field, nextDir);
    },
    [sortBy, sortDir, onSortChange],
  );

  const focusRow = useCallback(
    (index: number) => {
      setActiveIndex(index);
      virtualizer.scrollToIndex(index, { align: "auto" });
      // The row may need a frame to (re)mount after scrolling into view.
      requestAnimationFrame(() => {
        bodyRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.focus();
      });
    },
    [virtualizer],
  );

  const handleRowKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>, index: number, quake: EarthquakeEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect(quake);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        focusRow(Math.min(index + 1, rows.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        focusRow(Math.max(index - 1, 0));
      }
    },
    [focusRow, onSelect, rows.length],
  );

  const headers = useMemo(() => table.getFlatHeaders(), [table]);

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="relative flex-1 overflow-auto">
        <div role="grid" aria-rowcount={rows.length + 1} className="min-w-[620px] text-sm">
          {/* Header */}
          <div
            role="row"
            className="border-border bg-surface-1 sticky top-0 z-10 grid border-b"
            style={{ gridTemplateColumns: GRID_TEMPLATE }}
          >
            {headers.map((header) => {
              const id = header.column.id;
              const sortable = isSortField(id);
              const isSorted = sortable && sortBy === id;
              const alignRight = id === "depth" || id === "link";
              return (
                <div
                  key={header.id}
                  role="columnheader"
                  aria-sort={sortable ? (isSorted ? directionToAria(sortDir) : "none") : undefined}
                  className={`text-fg-muted px-3 py-2 text-xs font-medium tracking-wide uppercase ${
                    alignRight ? "text-right" : "text-left"
                  }`}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => handleSort(id)}
                      className="hover:text-fg inline-flex items-center gap-1"
                    >
                      {HEADER_LABELS[id]}
                      <span aria-hidden className="text-[0.65rem]">
                        {isSorted ? (sortDir === "asc" ? "▲" : "▼") : ""}
                      </span>
                    </button>
                  ) : (
                    HEADER_LABELS[id]
                  )}
                </div>
              );
            })}
          </div>

          {/* Body */}
          {rows.length === 0 ? (
            <div className="text-fg-muted grid place-items-center gap-3 py-16 text-sm">
              <span>No events match the current filters.</span>
              {onClearFilters ? (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="border-border bg-surface-2 text-fg hover:border-accent rounded border px-3 py-1 text-xs"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : (
            <div ref={bodyRef} style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
              {virtualRows.map((virtualRow) => {
                const row = rows[virtualRow.index];
                if (!row) return null;
                const quake = row.original;
                const isSelected = quake.id === selectedId;
                return (
                  <div
                    key={row.id}
                    role="row"
                    data-index={virtualRow.index}
                    aria-rowindex={virtualRow.index + 2}
                    aria-selected={isSelected}
                    tabIndex={virtualRow.index === activeIndex ? 0 : -1}
                    onFocus={() => setActiveIndex(virtualRow.index)}
                    onClick={() => {
                      setActiveIndex(virtualRow.index);
                      onSelect(quake);
                    }}
                    onKeyDown={(event) => handleRowKeyDown(event, virtualRow.index, quake)}
                    className={`border-border/50 focus-visible:ring-accent absolute top-0 left-0 grid w-full cursor-pointer items-center border-b outline-none focus-visible:ring-1 focus-visible:ring-inset ${
                      isSelected ? "bg-surface-2" : "hover:bg-surface-1"
                    }`}
                    style={{
                      height: ROW_HEIGHT,
                      transform: `translateY(${virtualRow.start}px)`,
                      gridTemplateColumns: GRID_TEMPLATE,
                    }}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const alignRight = cell.column.id === "depth" || cell.column.id === "link";
                      return (
                        <div
                          key={cell.id}
                          role="gridcell"
                          className={`flex min-w-0 items-center px-3 ${
                            alignRight ? "justify-end" : ""
                          }`}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TimeCell({ event }: { event: EarthquakeEvent }) {
  return (
    <span className="text-fg-secondary tabular-nums" title={event.time.toLocaleString()}>
      {formatRelativeTime(event.time, new Date())}
    </span>
  );
}

function MagnitudeBadge({ magnitude }: { magnitude: number | null }) {
  if (magnitude === null) {
    return <span className="text-fg-muted">—</span>;
  }
  const background = magnitudeColor(magnitude);
  // Dark colors (strong quakes) need light text; light colors need dark text.
  const color = magnitude >= 6 ? "#ffffff" : "#0a0b0d";
  return (
    <span
      className="inline-flex min-w-[2.5rem] justify-center rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums"
      style={{ backgroundColor: background, color }}
    >
      {magnitude.toFixed(1)}
    </span>
  );
}

function UsgsLink({ url, title }: { url: string; title: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => event.stopPropagation()}
      aria-label={`View "${title}" on USGS`}
      className="text-fg-muted hover:text-accent"
    >
      ↗
    </a>
  );
}

function directionToAria(direction: SortDirection): "ascending" | "descending" {
  return direction === "asc" ? "ascending" : "descending";
}
