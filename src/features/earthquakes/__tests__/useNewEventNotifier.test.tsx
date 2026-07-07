import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EventDiff } from "../diff";
import { useNewEventNotifier } from "../hooks/useNewEventNotifier";
import type { EarthquakeEvent } from "../types";
import { makeEvent } from "./fixtures";

interface Props {
  events: EarthquakeEvent[];
  resetKey: string;
}

const noEvents: EarthquakeEvent[] = [];
const spy = () => vi.fn<(diff: EventDiff) => void>();

describe("useNewEventNotifier", () => {
  it("adopts the first non-empty snapshot as a silent baseline", () => {
    const onNewEvents = spy();
    const a = makeEvent({ id: "a" });

    const { rerender } = renderHook(
      ({ events, resetKey }: Props) => useNewEventNotifier(events, { onNewEvents, resetKey }),
      { initialProps: { events: noEvents, resetKey: "all_day" } },
    );
    // First real data arrives (was empty while loading) → baseline, no notify.
    rerender({ events: [a], resetKey: "all_day" });

    expect(onNewEvents).not.toHaveBeenCalled();
  });

  it("notifies about events added after the baseline", () => {
    const onNewEvents = spy();
    const a = makeEvent({ id: "a" });
    const b = makeEvent({ id: "b" });

    const { rerender } = renderHook(
      ({ events, resetKey }: Props) => useNewEventNotifier(events, { onNewEvents, resetKey }),
      { initialProps: { events: [a], resetKey: "all_day" } },
    );
    rerender({ events: [a, b], resetKey: "all_day" });

    expect(onNewEvents).toHaveBeenCalledTimes(1);
    expect(onNewEvents.mock.calls[0]?.[0].added.map((e) => e.id)).toEqual(["b"]);
  });

  it("resets the baseline when the feed changes, without flooding", () => {
    const onNewEvents = spy();
    const a = makeEvent({ id: "a" });
    const b = makeEvent({ id: "b" });
    const c = makeEvent({ id: "c" });
    const d = makeEvent({ id: "d" });

    const { rerender } = renderHook(
      ({ events, resetKey }: Props) => useNewEventNotifier(events, { onNewEvents, resetKey }),
      { initialProps: { events: [a, b], resetKey: "all_day" } },
    );

    // Switch feed: an entirely different set of ids must NOT be reported as new.
    rerender({ events: [c, d], resetKey: "4.5_week" });
    expect(onNewEvents).not.toHaveBeenCalled();

    // A genuine new event on the new feed is reported normally.
    const e = makeEvent({ id: "e" });
    rerender({ events: [c, d, e], resetKey: "4.5_week" });
    expect(onNewEvents).toHaveBeenCalledTimes(1);
    expect(onNewEvents.mock.calls[0]?.[0].added.map((ev) => ev.id)).toEqual(["e"]);
  });

  it("re-settles through a loading blink after a feed change", () => {
    const onNewEvents = spy();
    const a = makeEvent({ id: "a" });

    const { rerender } = renderHook(
      ({ events, resetKey }: Props) => useNewEventNotifier(events, { onNewEvents, resetKey }),
      { initialProps: { events: [a], resetKey: "all_day" } },
    );

    // Feed change → transient empty (loading) → first data of the new feed.
    rerender({ events: [], resetKey: "2.5_day" });
    rerender({ events: [makeEvent({ id: "x" }), makeEvent({ id: "y" })], resetKey: "2.5_day" });

    expect(onNewEvents).not.toHaveBeenCalled();
  });
});
