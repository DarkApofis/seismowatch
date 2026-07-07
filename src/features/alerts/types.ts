/**
 * A geographic bounding box in degrees.
 *
 * `west`/`east` are longitudes, `south`/`north` latitudes. When `west > east`
 * the box is understood to cross the antimeridian (180°/-180°) — see
 * `matching.ts` for how membership is tested in that case.
 */
export interface BoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

/**
 * A user-defined alert: notify me about new events at or above `minMagnitude`,
 * optionally restricted to `region`.
 */
export interface AlertRule {
  id: string;
  /** Human label; defaults to a generated description if empty. */
  label: string;
  minMagnitude: number;
  /** `null` = anywhere on Earth. */
  region: BoundingBox | null;
  enabled: boolean;
}
