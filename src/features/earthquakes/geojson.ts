import type { Feature, FeatureCollection, Point } from "geojson";
import type { EarthquakeEvent } from "./types";

/**
 * Properties carried on each map feature. Deliberately minimal — only what the
 * GPU layers need for data-driven styling:
 *
 * - `id`     — promoted to the feature id (via `promoteId`) so MapLibre
 *              `feature-state` and hover/click lookups are stable across polls.
 * - `mag`    — numeric magnitude for the color/radius interpolations. USGS
 *              magnitude can be `null`; we substitute `0` so the interpolate
 *              expressions always receive a number (a `null` would break them).
 * - `timeMs` — origin time as epoch ms, used by the age-based opacity ramp.
 *
 * Rich display data (title, place, depth, the real nullable magnitude, the
 * USGS url) is intentionally NOT duplicated here — the map looks the full
 * {@link EarthquakeEvent} up by id for tooltips and popups.
 */
export interface EarthquakeFeatureProperties {
  id: string;
  mag: number;
  timeMs: number;
}

export type EarthquakeFeature = Feature<Point, EarthquakeFeatureProperties>;
export type EarthquakeFeatureCollection = FeatureCollection<Point, EarthquakeFeatureProperties>;

/**
 * Pure `EarthquakeEvent[] → GeoJSON FeatureCollection` conversion.
 *
 * Kept out of the map component so it can be unit-tested without MapLibre and
 * reused by the pulse layer. Coordinates are `[longitude, latitude]` (GeoJSON
 * order); depth is omitted from the geometry because the 2-D map doesn't use
 * the z axis.
 */
export function toGeoJson(events: readonly EarthquakeEvent[]): EarthquakeFeatureCollection {
  return {
    type: "FeatureCollection",
    features: events.map((event): EarthquakeFeature => ({
      type: "Feature",
      // Promoted to the feature id via `promoteId="id"` on the source.
      id: event.id,
      properties: {
        id: event.id,
        mag: event.magnitude ?? 0,
        timeMs: event.time.getTime(),
      },
      geometry: {
        type: "Point",
        coordinates: [event.longitude, event.latitude],
      },
    })),
  };
}
