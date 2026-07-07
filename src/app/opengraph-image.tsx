import { ImageResponse } from "next/og";

// Static-at-build Open Graph card rendered with the dashboard's dark look.
export const alt = "SeismoWatch — real-time earthquake dashboard";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#0a0b0d",
        color: "#e7e9ee",
        padding: 80,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "3px solid rgba(56,189,248,0.3)",
            boxShadow: "0 0 0 14px rgba(56,189,248,0.08)",
          }}
        >
          <div style={{ width: 34, height: 34, borderRadius: 999, background: "#38bdf8" }} />
        </div>
        <div style={{ fontSize: 60, fontWeight: 700, letterSpacing: -1 }}>SeismoWatch</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 40, fontWeight: 600 }}>Real-time earthquake dashboard</div>
        <div style={{ fontSize: 28, color: "#9aa1af" }}>
          Live map · virtualized 10k-row table · analytics · USGS feeds
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        {["#fadb14", "#fa8c16", "#fa541c", "#cf1322", "#9e1068"].map((color) => (
          <div key={color} style={{ width: 120, height: 12, borderRadius: 6, background: color }} />
        ))}
      </div>
    </div>,
    size,
  );
}
