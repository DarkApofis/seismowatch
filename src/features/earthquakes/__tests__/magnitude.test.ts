import { describe, expect, it } from "vitest";
import {
  MAGNITUDE_STOPS,
  magnitudeColor,
  magnitudeColorExpression,
  magnitudeRadius,
  magnitudeRadiusExpression,
} from "../magnitude";

describe("magnitudeColor", () => {
  it("returns the exact stop color at each range boundary", () => {
    for (const stop of MAGNITUDE_STOPS) {
      expect(magnitudeColor(stop.magnitude)).toBe(stop.color);
    }
  });

  it("clamps below the minimum stop to the first color", () => {
    expect(magnitudeColor(0)).toBe(MAGNITUDE_STOPS[0]?.color);
    expect(magnitudeColor(-5)).toBe(MAGNITUDE_STOPS[0]?.color);
  });

  it("clamps above the maximum stop to the last color", () => {
    const last = MAGNITUDE_STOPS[MAGNITUDE_STOPS.length - 1]?.color;
    expect(magnitudeColor(7)).toBe(last);
    expect(magnitudeColor(9.9)).toBe(last);
  });

  it("interpolates between two stops (M3 sits between the M2 and M4 colors)", () => {
    const color = magnitudeColor(3);
    expect(color).not.toBe(magnitudeColor(2));
    expect(color).not.toBe(magnitudeColor(4));
    // Midpoint of #fadb14 and #fa8c16 → red stays fa, green/blue averaged.
    expect(color).toBe("#fab415");
  });
});

describe("magnitudeRadius", () => {
  it("returns the base radius at magnitude 0 and clamps negatives", () => {
    expect(magnitudeRadius(0)).toBe(3);
    expect(magnitudeRadius(-2)).toBe(3);
  });

  it("increases monotonically with magnitude", () => {
    const radii = [2, 3, 4, 5, 6, 7].map(magnitudeRadius);
    for (let i = 1; i < radii.length; i += 1) {
      expect(radii[i]).toBeGreaterThan(radii[i - 1] ?? 0);
    }
  });

  it("grows non-linearly — the M6→M7 jump exceeds the M2→M3 jump", () => {
    const lowStep = magnitudeRadius(3) - magnitudeRadius(2);
    const highStep = magnitudeRadius(7) - magnitudeRadius(6);
    expect(highStep).toBeGreaterThan(lowStep);
  });

  it("makes M7 clearly larger than M4", () => {
    expect(magnitudeRadius(7)).toBeGreaterThan(magnitudeRadius(4) * 2);
  });
});

describe("MapLibre expression builders", () => {
  it("builds a color interpolate expression from the stops", () => {
    // The expression is an array at runtime; view it as one for assertions.
    const expr = magnitudeColorExpression() as readonly unknown[];
    expect(expr[0]).toBe("interpolate");
    expect(expr).toContain(MAGNITUDE_STOPS[0]?.color);
    // Each stop contributes a [magnitude, color] pair after the input.
    expect(expr).toHaveLength(3 + MAGNITUDE_STOPS.length * 2);
  });

  it("builds a radius interpolate expression sampled from magnitudeRadius", () => {
    const expr = magnitudeRadiusExpression() as readonly unknown[];
    expect(expr[0]).toBe("interpolate");
    // First sampled magnitude is 0 → base radius.
    expect(expr).toContain(magnitudeRadius(0));
  });
});
