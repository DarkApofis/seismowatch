import type { EarthquakeEvent } from "@/features/earthquakes/types";
import type { AlertRule, BoundingBox } from "./types";

/**
 * Whether a point falls inside a bounding box.
 *
 * Latitude is a simple range check. Longitude supports the antimeridian case:
 * when a box is built from a map viewport near ±180°, MapLibre reports
 * `west > east`, meaning the box wraps across the 180° seam. We handle it by
 * OR-ing the two longitude arcs (`>= west` OR `<= east`) instead of the usual
 * AND — so a box from, say, 170°E to -170°E correctly contains 179° and -179°.
 */
export function boundingBoxContains(
  box: BoundingBox,
  longitude: number,
  latitude: number,
): boolean {
  if (latitude < box.south || latitude > box.north) return false;

  const wrapsAntimeridian = box.west > box.east;
  return wrapsAntimeridian
    ? longitude >= box.west || longitude <= box.east
    : longitude >= box.west && longitude <= box.east;
}

/**
 * Pure predicate: does an event satisfy a rule?
 *
 * A disabled rule never matches. Events with unknown (`null`) magnitude can't
 * clear a magnitude threshold, so they never match. When a region is set the
 * event's coordinates must fall inside it (antimeridian-aware).
 */
export function matchesRule(event: EarthquakeEvent, rule: AlertRule): boolean {
  if (!rule.enabled) return false;
  if (event.magnitude === null || event.magnitude < rule.minMagnitude) return false;
  if (rule.region !== null && !boundingBoxContains(rule.region, event.longitude, event.latitude)) {
    return false;
  }
  return true;
}

/** Does an event match *any* of the rules? */
export function matchesAnyRule(event: EarthquakeEvent, rules: readonly AlertRule[]): boolean {
  return rules.some((rule) => matchesRule(event, rule));
}
