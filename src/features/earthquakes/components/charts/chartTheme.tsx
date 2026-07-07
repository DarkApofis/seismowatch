import type { CSSProperties } from "react";

/*
 * Recharts sets axis colors as SVG presentation *attributes*, which don't
 * resolve CSS `var()`. So these mirror the design tokens as literals — keep in
 * sync with globals.css (`--text-muted`, `--border`, `--surface-2`, etc.).
 */
export const AXIS_COLOR = "#616776"; // --text-muted
export const ACCENT_COLOR = "#38bdf8"; // --accent

/** Tooltip chrome (an HTML box, so tabular-nums applies here). */
export const TOOLTIP_STYLE: CSSProperties = {
  background: "#1b1e26",
  border: "1px solid #2a2e39",
  borderRadius: 6,
  color: "#e7e9ee",
  fontSize: 12,
  fontVariantNumeric: "tabular-nums",
};

export function ChartEmpty({ label }: { label: string }) {
  return <div className="text-fg-muted grid h-[180px] place-items-center text-xs">{label}</div>;
}
