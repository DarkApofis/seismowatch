import type { AlertRule, BoundingBox } from "./types";

export const ALERT_RULES_STORAGE_KEY = "seismowatch.alertRules";

/** Current on-disk schema version. Bump when the shape changes incompatibly. */
export const ALERT_RULES_SCHEMA_VERSION = 1;

interface StoredAlertRules {
  version: number;
  rules: AlertRule[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseBoundingBox(value: unknown): BoundingBox | null {
  if (!isRecord(value)) return null;
  const { west, south, east, north } = value;
  if (
    typeof west === "number" &&
    typeof south === "number" &&
    typeof east === "number" &&
    typeof north === "number" &&
    [west, south, east, north].every(Number.isFinite)
  ) {
    return { west, south, east, north };
  }
  return null;
}

function parseRule(value: unknown): AlertRule | null {
  if (!isRecord(value)) return null;
  const { id, label, minMagnitude, region, enabled } = value;
  if (typeof id !== "string" || id === "") return null;
  if (typeof minMagnitude !== "number" || !Number.isFinite(minMagnitude)) return null;
  return {
    id,
    label: typeof label === "string" ? label : "",
    minMagnitude,
    region: region == null ? null : parseBoundingBox(region),
    enabled: typeof enabled === "boolean" ? enabled : true,
  };
}

/**
 * Pure, defensive parse of the persisted rules.
 *
 * Returns `[]` for anything it can't trust — absent value, invalid JSON, wrong
 * or missing version, or a non-array payload — and silently drops individual
 * malformed rules while keeping the valid ones. localStorage is user-editable
 * and survives deploys, so this can never throw on bad input.
 */
export function parseStoredRules(raw: string | null): AlertRule[] {
  if (raw === null) return [];

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!isRecord(data) || data.version !== ALERT_RULES_SCHEMA_VERSION) return [];
  if (!Array.isArray(data.rules)) return [];

  return data.rules.map(parseRule).filter((rule): rule is AlertRule => rule !== null);
}

/** Pure serialization to the versioned envelope. */
export function serializeRules(rules: readonly AlertRule[]): string {
  const payload: StoredAlertRules = {
    version: ALERT_RULES_SCHEMA_VERSION,
    rules: [...rules],
  };
  return JSON.stringify(payload);
}
