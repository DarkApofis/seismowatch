/**
 * Type layer for the USGS Earthquake GeoJSON summary feed.
 *
 * Two distinct concerns live in this file, kept deliberately separate:
 *
 *  1. The *wire* types (`UsgsFeatureCollection` and friends) mirror the raw
 *     GeoJSON exactly as USGS serves it — epoch milliseconds, stringly-typed
 *     id lists, nullable numeric fields. These are the contract with the
 *     outside world; we do not "improve" them here.
 *
 *  2. The *domain* type (`EarthquakeEvent`) is the flat, ergonomic shape the
 *     rest of the app consumes — `Date` instead of epoch ms, depth lifted out
 *     of the geometry tuple, coordinates named. The transformation between the
 *     two is the pure function `toEarthquakeEvent`, which is trivially testable.
 *
 * Reference: https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php
 */

/** PAGER alert level. `null` when no alert has been issued for the event. */
export type UsgsAlertLevel = "green" | "yellow" | "orange" | "red";

/** Review lifecycle of the event as reported by the network. */
export type UsgsStatus = "automatic" | "reviewed" | "deleted";

/** `0` = no associated tsunami, `1` = event in an oceanic region that may generate one. */
export type UsgsTsunamiFlag = 0 | 1;

/**
 * Properties block of a single earthquake Feature.
 *
 * Nullability mirrors the real feed: `mag`, `felt`, `cdi`, `mmi`, `nst`,
 * `dmin`, `gap` and `tz` are frequently absent for small or freshly-detected
 * events and are therefore `number | null`.
 */
export interface UsgsFeatureProperties {
  /** Magnitude. `null` for some events pending review. */
  mag: number | null;
  /** Human-readable location, e.g. "14km SSW of Volcano, Hawaii". */
  place: string | null;
  /** Origin time, epoch milliseconds (UTC). */
  time: number;
  /** Last-update time, epoch milliseconds (UTC). */
  updated: number;
  /** Timezone offset in minutes from UTC. Deprecated by USGS; usually `null`. */
  tz: number | null;
  /** Canonical event page on earthquake.usgs.gov. */
  url: string;
  /** URL of the detailed (per-event) GeoJSON document. */
  detail: string;
  /** Number of "Did You Feel It?" responses. */
  felt: number | null;
  /** Community Determined Intensity (DYFI). */
  cdi: number | null;
  /** Modified Mercalli Intensity (instrumental). */
  mmi: number | null;
  /** PAGER alert level. */
  alert: UsgsAlertLevel | null;
  /** Review status. */
  status: UsgsStatus;
  /** Tsunami flag. */
  tsunami: UsgsTsunamiFlag;
  /** Significance (0–1000); higher means more noteworthy. */
  sig: number;
  /** Contributing network id, e.g. "us", "ci". */
  net: string;
  /** Event code assigned by the contributing network. */
  code: string;
  /** Comma-delimited list of all associated ids, e.g. ",us1234,ci5678,". */
  ids: string;
  /** Comma-delimited list of contributing networks. */
  sources: string;
  /** Comma-delimited list of available product types. */
  types: string;
  /** Number of seismic stations used to locate the event. */
  nst: number | null;
  /** Horizontal distance to the nearest station, in degrees. */
  dmin: number | null;
  /** Root-mean-square travel-time residual, in seconds. */
  rms: number;
  /** Largest azimuthal gap between stations, in degrees. */
  gap: number | null;
  /** Method used to compute magnitude, e.g. "ml", "mb", "mww". */
  magType: string;
  /** Event type, e.g. "earthquake", "quarry blast", "explosion". */
  type: string;
  /** Auto-generated title combining magnitude and place. */
  title: string;
}

/**
 * GeoJSON Point geometry for an event.
 *
 * Coordinates are `[longitude, latitude, depth]` where depth is in
 * kilometres. This ordering is GeoJSON-standard (lon before lat) and is a
 * classic source of bugs — the domain type below names each axis to avoid it.
 */
export interface UsgsPointGeometry {
  type: "Point";
  coordinates: [longitude: number, latitude: number, depth: number];
}

/** A single earthquake Feature. `id` is the canonical event id, e.g. "us7000abcd". */
export interface UsgsFeature {
  type: "Feature";
  properties: UsgsFeatureProperties;
  geometry: UsgsPointGeometry;
  id: string;
}

/** Metadata block accompanying every summary feed response. */
export interface UsgsFeedMetadata {
  /** Feed generation time, epoch milliseconds. */
  generated: number;
  url: string;
  title: string;
  /** HTTP-style status of the feed generation, typically 200. */
  status: number;
  api: string;
  count: number;
}

/** Top-level GeoJSON document returned by a summary feed endpoint. */
export interface UsgsFeatureCollection {
  type: "FeatureCollection";
  metadata: UsgsFeedMetadata;
  /** `[minLon, minLat, minDepth, maxLon, maxLat, maxDepth]`. Absent when empty. */
  bbox?: [number, number, number, number, number, number];
  features: UsgsFeature[];
}

/**
 * Normalized, flat domain model consumed by the app.
 *
 * Differences from the raw Feature, by design:
 *  - `time`/`updated` are `Date`, not epoch ms.
 *  - `longitude`, `latitude`, `depth` are named scalars, not a tuple.
 *  - Fields keep their nullability so the UI can distinguish "unknown" from a
 *    real zero (e.g. `mag: null` vs `mag: 0`).
 */
export interface EarthquakeEvent {
  id: string;
  magnitude: number | null;
  place: string | null;
  time: Date;
  updated: Date;
  url: string;
  detailUrl: string;
  felt: number | null;
  cdi: number | null;
  mmi: number | null;
  alert: UsgsAlertLevel | null;
  status: UsgsStatus;
  tsunami: boolean;
  significance: number;
  network: string;
  magType: string;
  eventType: string;
  title: string;
  longitude: number;
  latitude: number;
  /** Depth below the surface, in kilometres. */
  depth: number;
}
