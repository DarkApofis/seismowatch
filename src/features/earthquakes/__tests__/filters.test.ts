import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, type Filters, parseFilters, serializeFilters } from "../filters";

function roundTrip(filters: Filters): Filters {
  return parseFilters(serializeFilters(filters));
}

describe("parseFilters / serializeFilters", () => {
  it("round-trips a fully-populated non-default filter set", () => {
    const filters: Filters = {
      feedMagnitude: "4.5",
      timeWindow: "week",
      minMagnitude: 3.2,
      maxDepth: 70,
      searchText: "california",
      sortBy: "magnitude",
      sortDir: "asc",
    };
    expect(roundTrip(filters)).toEqual(filters);
  });

  it("round-trips the defaults through an empty query string", () => {
    const params = serializeFilters(DEFAULT_FILTERS);
    expect(params.toString()).toBe("");
    expect(parseFilters(params)).toEqual(DEFAULT_FILTERS);
  });

  it("omits default-valued fields from the query string", () => {
    const params = serializeFilters({ ...DEFAULT_FILTERS, minMagnitude: 5 });
    expect(params.toString()).toBe("minMag=5");
  });

  it("falls back to defaults for corrupt or unknown values", () => {
    const params = new URLSearchParams({
      mag: "not-a-feed",
      window: "decade",
      minMag: "abc",
      maxDepth: "-10", // negative depth is invalid
      sort: "sideways",
      dir: "up",
    });
    expect(parseFilters(params)).toEqual(DEFAULT_FILTERS);
  });

  it("treats a missing query entirely as defaults", () => {
    expect(parseFilters(new URLSearchParams())).toEqual(DEFAULT_FILTERS);
  });

  it("keeps a valid feed/window and trims search text", () => {
    const params = new URLSearchParams({ mag: "significant", window: "month", q: "  ridge  " });
    const parsed = parseFilters(params);
    expect(parsed.feedMagnitude).toBe("significant");
    expect(parsed.timeWindow).toBe("month");
    expect(parsed.searchText).toBe("ridge");
  });
});
