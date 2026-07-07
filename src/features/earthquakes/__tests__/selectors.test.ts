import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, type Filters } from "../filters";
import { filterEvents, sortEvents } from "../selectors";
import { makeEvent } from "./fixtures";

const withFilters = (overrides: Partial<Filters>): Filters => ({
  ...DEFAULT_FILTERS,
  ...overrides,
});

describe("filterEvents", () => {
  it("returns events unchanged under default (empty) filters", () => {
    const events = [makeEvent({ id: "a" }), makeEvent({ id: "b" })];
    expect(filterEvents(events, DEFAULT_FILTERS)).toEqual(events);
  });

  it("applies minMagnitude and drops unknown magnitudes when a bound is set", () => {
    const events = [
      makeEvent({ id: "weak", magnitude: 1.5 }),
      makeEvent({ id: "strong", magnitude: 5.2 }),
      makeEvent({ id: "unknown", magnitude: null }),
    ];
    const result = filterEvents(events, withFilters({ minMagnitude: 3 }));
    expect(result.map((e) => e.id)).toEqual(["strong"]);
  });

  it("applies maxDepth", () => {
    const events = [makeEvent({ id: "shallow", depth: 10 }), makeEvent({ id: "deep", depth: 300 })];
    const result = filterEvents(events, withFilters({ maxDepth: 100 }));
    expect(result.map((e) => e.id)).toEqual(["shallow"]);
  });

  it("matches searchText against place, case-insensitively", () => {
    const events = [
      makeEvent({ id: "ca", place: "12km N of Ridgecrest, CA" }),
      makeEvent({ id: "jp", place: "50km E of Tokyo, Japan" }),
      makeEvent({ id: "none", place: null }),
    ];
    const result = filterEvents(events, withFilters({ searchText: "TOKYO" }));
    expect(result.map((e) => e.id)).toEqual(["jp"]);
  });

  it("combines filters with AND semantics", () => {
    const events = [
      makeEvent({ id: "match", magnitude: 4, depth: 20, place: "Alaska" }),
      makeEvent({ id: "tooDeep", magnitude: 4, depth: 200, place: "Alaska" }),
      makeEvent({ id: "tooWeak", magnitude: 1, depth: 20, place: "Alaska" }),
    ];
    const result = filterEvents(
      events,
      withFilters({ minMagnitude: 3, maxDepth: 100, searchText: "alaska" }),
    );
    expect(result.map((e) => e.id)).toEqual(["match"]);
  });
});

describe("sortEvents", () => {
  it("does not mutate the input array", () => {
    const events = [makeEvent({ id: "a" }), makeEvent({ id: "b" })];
    const copy = [...events];
    sortEvents(events, "magnitude", "desc");
    expect(events).toEqual(copy);
  });

  it("sorts by magnitude descending with nulls last", () => {
    const events = [
      makeEvent({ id: "mid", magnitude: 4 }),
      makeEvent({ id: "null1", magnitude: null }),
      makeEvent({ id: "high", magnitude: 6 }),
      makeEvent({ id: "low", magnitude: 2 }),
    ];
    const result = sortEvents(events, "magnitude", "desc");
    expect(result.map((e) => e.id)).toEqual(["high", "mid", "low", "null1"]);
  });

  it("keeps nulls last even when sorting ascending", () => {
    const events = [
      makeEvent({ id: "null1", magnitude: null }),
      makeEvent({ id: "low", magnitude: 2 }),
      makeEvent({ id: "high", magnitude: 6 }),
    ];
    const result = sortEvents(events, "magnitude", "asc");
    expect(result.map((e) => e.id)).toEqual(["low", "high", "null1"]);
  });

  it("is stable — events tying on the sort key keep their input order", () => {
    const events = [
      makeEvent({ id: "first", magnitude: 5 }),
      makeEvent({ id: "second", magnitude: 5 }),
      makeEvent({ id: "third", magnitude: 5 }),
    ];
    const result = sortEvents(events, "magnitude", "desc");
    expect(result.map((e) => e.id)).toEqual(["first", "second", "third"]);
  });

  it("sorts by time descending (most recent first)", () => {
    const events = [
      makeEvent({ id: "old", time: new Date("2026-01-01T00:00:00Z") }),
      makeEvent({ id: "new", time: new Date("2026-01-02T00:00:00Z") }),
    ];
    expect(sortEvents(events, "time", "desc").map((e) => e.id)).toEqual(["new", "old"]);
  });
});
