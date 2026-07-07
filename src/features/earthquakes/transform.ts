import { InvalidGeometryError } from "./errors";
import type { EarthquakeEvent, UsgsFeature } from "./types";

/**
 * Pure Feature → EarthquakeEvent transform.
 *
 * Deliberately free of I/O so it is trivially unit-testable and reusable from
 * both the polling client and (later) the SSE diffing route handler.
 *
 * Throws {@link InvalidGeometryError} when the geometry is unusable. Everything
 * else in the feed is either well-typed or legitimately nullable, so we pass it
 * through as-is; we never fabricate values for missing data.
 */
export function toEarthquakeEvent(feature: UsgsFeature): EarthquakeEvent {
  const { id, properties: p, geometry } = feature;

  const coords = geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 3) {
    throw new InvalidGeometryError(id, "expected [longitude, latitude, depth] coordinates");
  }

  const [longitude, latitude, depth] = coords;
  if (![longitude, latitude, depth].every((n) => typeof n === "number" && Number.isFinite(n))) {
    throw new InvalidGeometryError(id, "coordinates must be finite numbers");
  }

  return {
    id,
    magnitude: p.mag,
    place: p.place,
    time: new Date(p.time),
    updated: new Date(p.updated),
    url: p.url,
    detailUrl: p.detail,
    felt: p.felt,
    cdi: p.cdi,
    mmi: p.mmi,
    alert: p.alert,
    status: p.status,
    tsunami: p.tsunami === 1,
    significance: p.sig,
    network: p.net,
    magType: p.magType,
    eventType: p.type,
    title: p.title,
    longitude,
    latitude,
    depth,
  };
}
