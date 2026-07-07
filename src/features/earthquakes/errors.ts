/** Base class for every error originating in the earthquakes feature. */
export class EarthquakeError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

/**
 * Thrown by `toEarthquakeEvent` when a Feature's geometry cannot be trusted —
 * missing coordinates, wrong arity, or non-finite numbers. Malformed geometry
 * is treated as exceptional (a data-integrity failure for a single record)
 * rather than as expected control flow.
 */
export class InvalidGeometryError extends EarthquakeError {
  constructor(
    public readonly eventId: string,
    message: string,
  ) {
    super(`Invalid geometry for event "${eventId}": ${message}`);
  }
}

/** Reasons `fetchEarthquakes` can fail, surfaced through the `Result` type. */
export type FetchErrorKind = "network" | "http" | "parse";

/**
 * Non-throwing description of a failed feed fetch. Returned inside a `Result`
 * rather than thrown, because network/HTTP failures are an expected part of a
 * polling loop, not exceptional events.
 */
export interface FetchError {
  kind: FetchErrorKind;
  message: string;
  /** HTTP status code, present only when `kind === "http"`. */
  status?: number;
  /** Underlying error for `network`/`parse` failures, if any. */
  cause?: unknown;
}
