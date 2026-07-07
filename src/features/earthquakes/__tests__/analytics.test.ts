import { describe, expect, it } from "vitest";
import { frequencyTimeline, magnitudeHistogram, timelineGranularity } from "../analytics";
import { makeEvent } from "./fixtures";

describe("magnitudeHistogram", () => {
  it("returns [] when there are no measured events", () => {
    expect(magnitudeHistogram([])).toEqual([]);
    expect(magnitudeHistogram([makeEvent({ magnitude: null })])).toEqual([]);
  });

  it("puts a single event in one bin", () => {
    const bins = magnitudeHistogram([makeEvent({ magnitude: 4.7 })]);
    expect(bins).toHaveLength(1);
    expect(bins[0]?.binStart).toBe(4.5);
    expect(bins[0]?.count).toBe(1);
  });

  it("buckets into contiguous 0.5-wide bins, gap-filled with zeros", () => {
    const bins = magnitudeHistogram([
      makeEvent({ id: "a", magnitude: 2.1 }),
      makeEvent({ id: "b", magnitude: 2.4 }),
      makeEvent({ id: "c", magnitude: 3.6 }),
    ]);
    // Bins: [2.0, 2.5, 3.0, 3.5]
    expect(bins.map((bin) => bin.binStart)).toEqual([2.0, 2.5, 3.0, 3.5]);
    expect(bins.map((bin) => bin.count)).toEqual([2, 0, 0, 1]);
  });

  it("assigns each bin a color from the magnitude scale", () => {
    const bins = magnitudeHistogram([makeEvent({ magnitude: 6.2 })]);
    expect(bins[0]?.color).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("timelineGranularity", () => {
  it("uses hourly buckets for short windows and daily for long ones", () => {
    expect(timelineGranularity("hour")).toBe("hour");
    expect(timelineGranularity("day")).toBe("hour");
    expect(timelineGranularity("week")).toBe("day");
    expect(timelineGranularity("month")).toBe("day");
  });
});

describe("frequencyTimeline", () => {
  it("returns [] for no events", () => {
    expect(frequencyTimeline([], "hour")).toEqual([]);
  });

  it("buckets a single event into one point", () => {
    const points = frequencyTimeline(
      [makeEvent({ time: new Date("2026-01-01T03:20:00Z") })],
      "hour",
    );
    expect(points).toHaveLength(1);
    expect(points[0]?.count).toBe(1);
    expect(points[0]?.bucketStart).toBe(Date.parse("2026-01-01T03:00:00Z"));
  });

  it("gap-fills hourly buckets between the first and last event", () => {
    const points = frequencyTimeline(
      [
        makeEvent({ id: "a", time: new Date("2026-01-01T01:10:00Z") }),
        makeEvent({ id: "b", time: new Date("2026-01-01T01:50:00Z") }),
        makeEvent({ id: "c", time: new Date("2026-01-01T04:05:00Z") }),
      ],
      "hour",
    );
    // 01:00, 02:00, 03:00, 04:00 → counts 2, 0, 0, 1
    expect(points.map((point) => point.count)).toEqual([2, 0, 0, 1]);
  });

  it("uses day-aligned buckets at day granularity", () => {
    const points = frequencyTimeline(
      [
        makeEvent({ id: "a", time: new Date("2026-01-01T23:00:00Z") }),
        makeEvent({ id: "b", time: new Date("2026-01-03T01:00:00Z") }),
      ],
      "day",
    );
    expect(points.map((point) => point.count)).toEqual([1, 0, 1]);
    expect(points[0]?.bucketStart).toBe(Date.parse("2026-01-01T00:00:00Z"));
  });
});
