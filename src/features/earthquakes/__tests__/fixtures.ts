import { toEarthquakeEvent } from "../transform";
import type { EarthquakeEvent, UsgsFeature } from "../types";

/**
 * A fully-populated, realistic Feature modeled on an actual M4.5 summary-feed
 * record. Tests clone and mutate this rather than hand-rolling objects, so a
 * schema change only needs updating in one place.
 */
export function makeFeature(overrides: Partial<UsgsFeature> = {}): UsgsFeature {
  return {
    type: "Feature",
    id: "us7000abcd",
    properties: {
      mag: 4.5,
      place: "14km SSW of Volcano, Hawaii",
      time: 1_720_000_000_000,
      updated: 1_720_000_600_000,
      tz: null,
      url: "https://earthquake.usgs.gov/earthquakes/eventpage/us7000abcd",
      detail: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/us7000abcd.geojson",
      felt: 3,
      cdi: 2.7,
      mmi: 4.1,
      alert: "green",
      status: "reviewed",
      tsunami: 1,
      sig: 312,
      net: "us",
      code: "7000abcd",
      ids: ",us7000abcd,",
      sources: ",us,",
      types: ",origin,phase-data,",
      nst: 42,
      dmin: 0.123,
      rms: 0.87,
      gap: 78,
      magType: "mww",
      type: "earthquake",
      title: "M 4.5 - 14km SSW of Volcano, Hawaii",
    },
    geometry: {
      type: "Point",
      coordinates: [-155.23, 19.38, 12.4],
    },
    ...overrides,
  };
}

/**
 * A normalized {@link EarthquakeEvent} built from the canonical fixture, with
 * shallow overrides. Handy for diff/hook tests that work on the domain model
 * and only care about a couple of fields (usually `id` and `updated`).
 */
export function makeEvent(overrides: Partial<EarthquakeEvent> = {}): EarthquakeEvent {
  return { ...toEarthquakeEvent(makeFeature()), ...overrides };
}
