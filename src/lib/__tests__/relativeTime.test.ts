import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "../relativeTime";

describe("formatRelativeTime", () => {
  const now = new Date("2026-07-06T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it("shows 'just now' under 5 seconds and clamps future times", () => {
    expect(formatRelativeTime(ago(2000), now)).toBe("just now");
    expect(formatRelativeTime(new Date(now.getTime() + 10_000), now)).toBe("just now");
  });

  it("formats seconds, minutes, hours and days", () => {
    expect(formatRelativeTime(ago(23_000), now)).toBe("23s ago");
    expect(formatRelativeTime(ago(5 * 60_000), now)).toBe("5m ago");
    expect(formatRelativeTime(ago(2 * 3_600_000), now)).toBe("2h ago");
    expect(formatRelativeTime(ago(3 * 86_400_000), now)).toBe("3d ago");
  });

  it("crosses unit boundaries correctly", () => {
    expect(formatRelativeTime(ago(59_000), now)).toBe("59s ago");
    expect(formatRelativeTime(ago(60_000), now)).toBe("1m ago");
    expect(formatRelativeTime(ago(3_600_000), now)).toBe("1h ago");
  });
});
