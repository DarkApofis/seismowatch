import { describe, expect, it } from "vitest";
import { makeEvent } from "@/features/earthquakes/__tests__/fixtures";
import { boundingBoxContains, matchesAnyRule, matchesRule } from "../matching";
import type { AlertRule, BoundingBox } from "../types";

const rule = (overrides: Partial<AlertRule> = {}): AlertRule => ({
  id: "r1",
  label: "",
  minMagnitude: 4,
  region: null,
  enabled: true,
  ...overrides,
});

describe("matchesRule", () => {
  it("matches when magnitude is at or above the threshold", () => {
    expect(matchesRule(makeEvent({ magnitude: 4 }), rule({ minMagnitude: 4 }))).toBe(true);
    expect(matchesRule(makeEvent({ magnitude: 5.5 }), rule({ minMagnitude: 4 }))).toBe(true);
  });

  it("does not match below the threshold or for unknown magnitude", () => {
    expect(matchesRule(makeEvent({ magnitude: 3.9 }), rule({ minMagnitude: 4 }))).toBe(false);
    expect(matchesRule(makeEvent({ magnitude: null }), rule({ minMagnitude: 4 }))).toBe(false);
  });

  it("never matches a disabled rule", () => {
    expect(matchesRule(makeEvent({ magnitude: 9 }), rule({ enabled: false }))).toBe(false);
  });

  it("respects a region restriction", () => {
    const region: BoundingBox = { west: -125, south: 32, east: -114, north: 42 }; // California-ish
    const inside = makeEvent({ magnitude: 5, longitude: -120, latitude: 37 });
    const outside = makeEvent({ magnitude: 5, longitude: 140, latitude: 37 });
    expect(matchesRule(inside, rule({ region }))).toBe(true);
    expect(matchesRule(outside, rule({ region }))).toBe(false);
  });
});

describe("boundingBoxContains — antimeridian", () => {
  // A box spanning 170°E → -170°E wraps across the 180° seam (west > east).
  const wrapping: BoundingBox = { west: 170, south: -10, east: -170, north: 10 };

  it("includes points on both sides of the 180° line", () => {
    expect(boundingBoxContains(wrapping, 179, 0)).toBe(true);
    expect(boundingBoxContains(wrapping, -179, 0)).toBe(true);
  });

  it("excludes points outside the wrapped longitude arc", () => {
    expect(boundingBoxContains(wrapping, 0, 0)).toBe(false);
    expect(boundingBoxContains(wrapping, 160, 0)).toBe(false);
  });

  it("still respects latitude bounds while wrapping", () => {
    expect(boundingBoxContains(wrapping, 179, 50)).toBe(false);
  });
});

describe("matchesAnyRule", () => {
  it("is true when at least one rule matches", () => {
    const event = makeEvent({ magnitude: 4.2 });
    const rules = [rule({ id: "a", minMagnitude: 6 }), rule({ id: "b", minMagnitude: 4 })];
    expect(matchesAnyRule(event, rules)).toBe(true);
  });

  it("is false when no rule matches", () => {
    const event = makeEvent({ magnitude: 2 });
    expect(matchesAnyRule(event, [rule({ minMagnitude: 4 })])).toBe(false);
  });
});
