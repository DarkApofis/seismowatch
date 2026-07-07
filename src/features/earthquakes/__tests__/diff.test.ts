import { describe, expect, it } from "vitest";
import { detectNewEvents } from "../diff";
import { makeEvent } from "./fixtures";

describe("detectNewEvents", () => {
  it("reports every event as added when the previous snapshot is empty", () => {
    const a = makeEvent({ id: "a" });
    const b = makeEvent({ id: "b" });

    const diff = detectNewEvents([], [a, b]);

    expect(diff.added).toEqual([a, b]);
    expect(diff.updated).toEqual([]);
  });

  it("reports only ids that were absent before as added", () => {
    const a = makeEvent({ id: "a" });
    const b = makeEvent({ id: "b" });
    const c = makeEvent({ id: "c" });

    const diff = detectNewEvents([a], [a, b, c]);

    expect(diff.added).toEqual([b, c]);
    expect(diff.updated).toEqual([]);
  });

  it("reports a re-seen id as updated when its `updated` timestamp advanced", () => {
    const before = makeEvent({ id: "a", updated: new Date("2026-01-01T00:00:00Z") });
    const after = makeEvent({ id: "a", updated: new Date("2026-01-01T00:05:00Z") });

    const diff = detectNewEvents([before], [after]);

    expect(diff.added).toEqual([]);
    expect(diff.updated).toEqual([after]);
  });

  it("does not report an event whose `updated` timestamp is unchanged", () => {
    const timestamp = new Date("2026-01-01T00:00:00Z");
    const before = makeEvent({ id: "a", updated: timestamp });
    const after = makeEvent({ id: "a", updated: new Date(timestamp) });

    const diff = detectNewEvents([before], [after]);

    expect(diff.added).toEqual([]);
    expect(diff.updated).toEqual([]);
  });

  it("does not report an event whose `updated` timestamp went backwards", () => {
    const before = makeEvent({ id: "a", updated: new Date("2026-01-01T00:05:00Z") });
    const stale = makeEvent({ id: "a", updated: new Date("2026-01-01T00:00:00Z") });

    const diff = detectNewEvents([before], [stale]);

    expect(diff.added).toEqual([]);
    expect(diff.updated).toEqual([]);
  });

  it("preserves the order of `current` in the added list", () => {
    const a = makeEvent({ id: "a" });
    const b = makeEvent({ id: "b" });
    const c = makeEvent({ id: "c" });

    const diff = detectNewEvents([a], [b, a, c]);

    expect(diff.added.map((e) => e.id)).toEqual(["b", "c"]);
  });
});
