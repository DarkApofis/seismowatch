"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { magnitudeHistogram } from "../../analytics";
import type { EarthquakeEvent } from "../../types";
import { AXIS_COLOR, ChartEmpty, TOOLTIP_STYLE } from "./chartTheme";

export function MagnitudeHistogram({ events }: { events: readonly EarthquakeEvent[] }) {
  const reducedMotion = usePrefersReducedMotion();
  const data = magnitudeHistogram(events);

  if (data.length === 0) return <ChartEmpty label="No magnitude data" />;

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
        <XAxis
          dataKey="binStart"
          tickFormatter={(value: number) => value.toFixed(1)}
          tick={{ fill: AXIS_COLOR, fontSize: 11 }}
          tickLine={{ stroke: AXIS_COLOR }}
          axisLine={{ stroke: AXIS_COLOR }}
        />
        <YAxis
          allowDecimals={false}
          width={40}
          tick={{ fill: AXIS_COLOR, fontSize: 11 }}
          tickLine={{ stroke: AXIS_COLOR }}
          axisLine={{ stroke: AXIS_COLOR }}
        />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.05)" }}
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={(label) =>
            `M ${Number(label).toFixed(1)}–${(Number(label) + 0.5).toFixed(1)}`
          }
          formatter={(value) => [String(value), "Events"]}
        />
        <Bar dataKey="count" isAnimationActive={!reducedMotion} radius={[2, 2, 0, 0]}>
          {data.map((bin) => (
            <Cell key={bin.binStart} fill={bin.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
