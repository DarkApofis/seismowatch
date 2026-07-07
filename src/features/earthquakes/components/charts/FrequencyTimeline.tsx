"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { frequencyTimeline, timelineGranularity } from "../../analytics";
import type { FeedWindow } from "../../api";
import type { EarthquakeEvent } from "../../types";
import { ACCENT_COLOR, AXIS_COLOR, ChartEmpty, TOOLTIP_STYLE } from "./chartTheme";

function formatTick(ms: number, granularity: "hour" | "day"): string {
  const date = new Date(ms);
  return granularity === "hour"
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function FrequencyTimeline({
  events,
  timeWindow,
}: {
  events: readonly EarthquakeEvent[];
  timeWindow: FeedWindow;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const granularity = timelineGranularity(timeWindow);
  const data = frequencyTimeline(events, granularity);

  if (data.length === 0) return <ChartEmpty label="No events in range" />;

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
        <defs>
          <linearGradient id="timelineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT_COLOR} stopOpacity={0.4} />
            <stop offset="100%" stopColor={ACCENT_COLOR} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="bucketStart"
          tickFormatter={(value: number) => formatTick(value, granularity)}
          tick={{ fill: AXIS_COLOR, fontSize: 11 }}
          tickLine={{ stroke: AXIS_COLOR }}
          axisLine={{ stroke: AXIS_COLOR }}
          minTickGap={24}
        />
        <YAxis
          allowDecimals={false}
          width={40}
          tick={{ fill: AXIS_COLOR, fontSize: 11 }}
          tickLine={{ stroke: AXIS_COLOR }}
          axisLine={{ stroke: AXIS_COLOR }}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={(label) => formatTick(Number(label), granularity)}
          formatter={(value) => [String(value), "Events"]}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke={ACCENT_COLOR}
          strokeWidth={2}
          fill="url(#timelineFill)"
          isAnimationActive={!reducedMotion}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
