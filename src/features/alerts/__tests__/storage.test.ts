import { describe, expect, it } from "vitest";
import { parseStoredRules, serializeRules } from "../storage";
import type { AlertRule } from "../types";

const sampleRule: AlertRule = {
  id: "abc",
  label: "Big ones near me",
  minMagnitude: 5,
  region: { west: -125, south: 32, east: -114, north: 42 },
  enabled: true,
};

describe("parseStoredRules / serializeRules", () => {
  it("round-trips valid rules", () => {
    const restored = parseStoredRules(serializeRules([sampleRule]));
    expect(restored).toEqual([sampleRule]);
  });

  it("returns [] for null (nothing stored)", () => {
    expect(parseStoredRules(null)).toEqual([]);
  });

  it("returns [] for invalid JSON", () => {
    expect(parseStoredRules("{not json")).toEqual([]);
  });

  it("returns [] when the schema version is missing or wrong", () => {
    expect(parseStoredRules(JSON.stringify({ rules: [sampleRule] }))).toEqual([]);
    expect(parseStoredRules(JSON.stringify({ version: 99, rules: [sampleRule] }))).toEqual([]);
  });

  it("returns [] when rules is not an array", () => {
    expect(parseStoredRules(JSON.stringify({ version: 1, rules: "nope" }))).toEqual([]);
  });

  it("drops individual malformed rules but keeps valid ones", () => {
    const raw = JSON.stringify({
      version: 1,
      rules: [
        sampleRule,
        { id: "", minMagnitude: 4 }, // empty id
        { id: "x", minMagnitude: "high" }, // non-numeric magnitude
        { id: "y", minMagnitude: 3 }, // valid, minimal
      ],
    });
    const parsed = parseStoredRules(raw);
    expect(parsed.map((r) => r.id)).toEqual(["abc", "y"]);
  });

  it("coerces a corrupt region to null rather than failing", () => {
    const raw = JSON.stringify({
      version: 1,
      rules: [{ id: "z", minMagnitude: 4, region: { west: "west" }, enabled: true }],
    });
    const parsed = parseStoredRules(raw);
    expect(parsed[0]?.region).toBeNull();
  });

  it("defaults enabled to true and label to empty when absent", () => {
    const raw = JSON.stringify({ version: 1, rules: [{ id: "z", minMagnitude: 4 }] });
    const parsed = parseStoredRules(raw);
    expect(parsed[0]).toMatchObject({ id: "z", minMagnitude: 4, enabled: true, label: "" });
  });
});
