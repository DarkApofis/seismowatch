import { describe, expect, it } from "vitest";
import { toGeoJson } from "../geojson";
import { makeEvent } from "./fixtures";

describe("toGeoJson", () => {
  it("converts a normal event into a Point feature", () => {
    const event = makeEvent({
      id: "us1",
      magnitude: 4.5,
      longitude: -155.23,
      latitude: 19.38,
      time: new Date("2026-01-01T00:00:00Z"),
    });

    const fc = toGeoJson([event]);

    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features).toHaveLength(1);
    const feature = fc.features[0];
    expect(feature?.geometry).toEqual({ type: "Point", coordinates: [-155.23, 19.38] });
    expect(feature?.properties).toEqual({
      id: "us1",
      mag: 4.5,
      timeMs: Date.parse("2026-01-01T00:00:00Z"),
    });
  });

  it("returns an empty FeatureCollection for an empty list", () => {
    const fc = toGeoJson([]);
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features).toEqual([]);
  });

  it("preserves the id on both the feature and its properties for feature-state", () => {
    const fc = toGeoJson([makeEvent({ id: "ci-abc" })]);
    const feature = fc.features[0];
    expect(feature?.id).toBe("ci-abc");
    expect(feature?.properties.id).toBe("ci-abc");
  });

  it("substitutes 0 for a null magnitude so styling expressions stay numeric", () => {
    const fc = toGeoJson([makeEvent({ id: "x", magnitude: null })]);
    expect(fc.features[0]?.properties.mag).toBe(0);
  });
});
