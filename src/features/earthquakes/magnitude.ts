import type { ExpressionSpecification } from "maplibre-gl";

/**
 * Magnitude → color scale, inspired by the USGS ShakeMap intensity ramp:
 * yellow (minor) → orange → red-orange → red → magenta (great).
 *
 * This is the single source of truth for magnitude coloring. The CSS custom
 * properties in `globals.css` (`--mag-2` … `--mag-7`) mirror these values for
 * legend/badge UI and MUST be kept in sync; the map reads them from here so the
 * dots and any HTML swatches always agree.
 *
 * Colors are lowercase `#rrggbb` so string comparisons (and the MapLibre
 * `interpolate` expression built below) are deterministic.
 */
export interface MagnitudeStop {
  magnitude: number;
  color: string;
}

export const MAGNITUDE_STOPS: readonly MagnitudeStop[] = [
  { magnitude: 2, color: "#fadb14" }, // yellow — minor
  { magnitude: 4, color: "#fa8c16" }, // orange — light
  { magnitude: 5, color: "#fa541c" }, // red-orange — moderate
  { magnitude: 6, color: "#cf1322" }, // red — strong
  { magnitude: 7, color: "#9e1068" }, // magenta — major/great
] as const;

// Non-linear radius scale. Seismic energy grows exponentially with magnitude,
// so a linear radius would make large quakes visually indistinguishable from
// moderate ones. A quadratic term keeps M2–M4 compact while making M7+ clearly
// dominant on the map.
const RADIUS_BASE_PX = 3;
const RADIUS_SCALE = 0.5;
const RADIUS_EXPONENT = 2;

// Integer magnitudes sampled to build the MapLibre radius interpolation.
const RADIUS_SAMPLE_MAGNITUDES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return [r, g, b];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Color for a magnitude, by piecewise-linear interpolation over
 * {@link MAGNITUDE_STOPS} in RGB space. Values below/above the range clamp to
 * the first/last stop. This mirrors exactly what MapLibre's `interpolate` does
 * on the GPU, so the JS-rendered legend and the map layer never diverge.
 */
export function magnitudeColor(mag: number): string {
  const first = MAGNITUDE_STOPS[0];
  const last = MAGNITUDE_STOPS[MAGNITUDE_STOPS.length - 1];
  // Non-null: the array is a non-empty readonly literal.
  if (first === undefined || last === undefined) {
    throw new Error("MAGNITUDE_STOPS must not be empty");
  }

  if (mag <= first.magnitude) return first.color;
  if (mag >= last.magnitude) return last.color;

  for (let i = 0; i < MAGNITUDE_STOPS.length - 1; i += 1) {
    const lower = MAGNITUDE_STOPS[i];
    const upper = MAGNITUDE_STOPS[i + 1];
    if (lower === undefined || upper === undefined) continue;
    if (mag >= lower.magnitude && mag <= upper.magnitude) {
      const t = (mag - lower.magnitude) / (upper.magnitude - lower.magnitude);
      const [r1, g1, b1] = hexToRgb(lower.color);
      const [r2, g2, b2] = hexToRgb(upper.color);
      return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
    }
  }

  return last.color;
}

/**
 * Rendered radius (in pixels) for a magnitude. Non-linear (see constants);
 * negative magnitudes clamp to 0 so micro-events still get the base radius.
 */
export function magnitudeRadius(mag: number): number {
  const m = Math.max(mag, 0);
  return RADIUS_BASE_PX + RADIUS_SCALE * m ** RADIUS_EXPONENT;
}

/**
 * MapLibre `interpolate` expression for `circle-color`, generated from
 * {@link MAGNITUDE_STOPS}. Reads the numeric `mag` property of each feature.
 */
export function magnitudeColorExpression(): ExpressionSpecification {
  const stops = MAGNITUDE_STOPS.flatMap((stop) => [stop.magnitude, stop.color]);
  return ["interpolate", ["linear"], ["get", "mag"], ...stops] as ExpressionSpecification;
}

/**
 * MapLibre `interpolate` expression for `circle-radius`, sampled from the same
 * {@link magnitudeRadius} function so the GPU-side radii match the TS scale.
 */
export function magnitudeRadiusExpression(): ExpressionSpecification {
  const stops = RADIUS_SAMPLE_MAGNITUDES.flatMap((m) => [m, magnitudeRadius(m)]);
  return ["interpolate", ["linear"], ["get", "mag"], ...stops] as ExpressionSpecification;
}
