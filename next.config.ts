import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const CARTO = "https://*.basemaps.cartocdn.com https://basemaps.cartocdn.com";

/**
 * Content-Security-Policy tuned for MapLibre GL + Carto tiles.
 *
 * The non-obvious bits:
 *  - `worker-src blob:` — MapLibre spins up its rendering/worker threads from
 *    blob: URLs; without this the map silently fails to initialize.
 *  - `img-src ... blob: data:` — vector tiles are drawn to canvases and Carto
 *    serves raster/sprite assets; MapLibre also reads image data as blobs.
 *  - `connect-src` — the USGS feeds and the Carto style JSON / glyphs / sprites
 *    are fetched at runtime.
 *  - `script-src 'unsafe-inline'` — Next injects a small inline bootstrap; a
 *    nonce-based policy is stronger but needs per-request rendering, which this
 *    fully-static export deliberately avoids. Documented tradeoff for a
 *    portfolio app. `'unsafe-eval'` is added in dev only for React Fast Refresh.
 */
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: ${CARTO}`,
  `connect-src 'self' https://earthquake.usgs.gov ${CARTO}${isDev ? " ws:" : ""}`,
  `worker-src 'self' blob:`,
  `font-src 'self' data:`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
]
  .join("; ")
  .concat(isDev ? "" : "; upgrade-insecure-requests");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
