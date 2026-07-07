import { describe, expect, it } from "vitest";
import { InvalidGeometryError } from "../errors";
import { toEarthquakeEvent } from "../transform";
import type { UsgsPointGeometry } from "../types";
import { makeFeature } from "./fixtures";

describe("toEarthquakeEvent", () => {
  it("normalizes a fully-populated event", () => {
    const event = toEarthquakeEvent(makeFeature());

    expect(event).toEqual({
      id: "us7000abcd",
      magnitude: 4.5,
      place: "14km SSW of Volcano, Hawaii",
      time: new Date(1_720_000_000_000),
      updated: new Date(1_720_000_600_000),
      url: "https://earthquake.usgs.gov/earthquakes/eventpage/us7000abcd",
      detailUrl: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/us7000abcd.geojson",
      felt: 3,
      cdi: 2.7,
      mmi: 4.1,
      alert: "green",
      status: "reviewed",
      tsunami: true,
      significance: 312,
      network: "us",
      magType: "mww",
      eventType: "earthquake",
      title: "M 4.5 - 14km SSW of Volcano, Hawaii",
      longitude: -155.23,
      latitude: 19.38,
      depth: 12.4,
    });
  });

  it("converts epoch milliseconds to Date and lifts depth out of geometry", () => {
    const event = toEarthquakeEvent(makeFeature());

    expect(event.time).toBeInstanceOf(Date);
    expect(event.time.getTime()).toBe(1_720_000_000_000);
    expect(event.depth).toBe(12.4);
  });

  it("preserves null fields instead of coercing them (unknown ≠ zero)", () => {
    const event = toEarthquakeEvent(
      makeFeature({
        properties: {
          ...makeFeature().properties,
          mag: null,
          place: null,
          felt: null,
          cdi: null,
          mmi: null,
          alert: null,
          tsunami: 0,
        },
      }),
    );

    expect(event.magnitude).toBeNull();
    expect(event.place).toBeNull();
    expect(event.felt).toBeNull();
    expect(event.cdi).toBeNull();
    expect(event.mmi).toBeNull();
    expect(event.alert).toBeNull();
    expect(event.tsunami).toBe(false);
  });

  describe("invalid geometry", () => {
    it("throws when coordinates are too short", () => {
      const geometry = {
        type: "Point",
        coordinates: [-155.23, 19.38],
      } as unknown as UsgsPointGeometry;

      expect(() => toEarthquakeEvent(makeFeature({ geometry }))).toThrow(InvalidGeometryError);
    });

    it("throws when a coordinate is not a finite number", () => {
      const geometry = {
        type: "Point",
        coordinates: [-155.23, Number.NaN, 12.4],
      } as unknown as UsgsPointGeometry;

      expect(() => toEarthquakeEvent(makeFeature({ geometry }))).toThrow(/finite numbers/);
    });

    it("throws when geometry is missing entirely", () => {
      const feature = makeFeature();
      // Simulate a malformed record without loosening the public type.
      const broken = { ...feature, geometry: undefined } as unknown as Parameters<
        typeof toEarthquakeEvent
      >[0];

      expect(() => toEarthquakeEvent(broken)).toThrow(InvalidGeometryError);
    });

    it("includes the offending event id in the error", () => {
      const geometry = {
        type: "Point",
        coordinates: [],
      } as unknown as UsgsPointGeometry;

      expect(() => toEarthquakeEvent(makeFeature({ id: "ci404", geometry }))).toThrow(/ci404/);
    });
  });
});
