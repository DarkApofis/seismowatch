# SeismoWatch

A real-time earthquake dashboard built on the public [USGS GeoJSON feeds](https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/). It shows a live global map, a virtualized table of up to ~10k events, magnitude/frequency analytics, and configurable browser alerts — all filterable, with the filters encoded in the URL so any view is shareable.

**Live demo:** [https://seismowatch-neon.vercel.app/]() · **Stack:** Next.js 15 (App Router) · TypeScript (strict) · Tailwind v4 · MapLibre GL · TanStack Query/Table/Virtual · Recharts · Vitest

> _Add a screenshot at `<img width="1919" height="945" alt="Captura de pantalla 2026-07-06 230247" src="https://github.com/user-attachments/assets/5bb68b30-97b7-402d-919d-84bb9e9f17c4" />
` and reference it here — recruiters look for a visual first._

This is a portfolio project: I optimized for code quality and clear architectural decisions over raw feature count. There are **no `any` and no `@ts-ignore`** in the codebase, and business logic is kept in pure, unit-tested functions separate from React.

## Running locally

```bash
pnpm install
pnpm dev          # http://localhost:3000

pnpm typecheck    # tsc --noEmit (strict, noUncheckedIndexedAccess)
pnpm lint         # eslint .
pnpm test         # vitest run  (84 tests)
pnpm build        # production build
```

Requires Node 20+ and pnpm. No API keys — the USGS feeds and the Carto base map are public.

## Architecture highlights

**The URL is the single source of truth for view state.** Feed, magnitude/depth filters, place search, and sort all live in the query string — there is no Zustand/Redux/Context store, because nothing here isn't derivable from `URL + server data`. That makes every view shareable and refresh-proof for free. Parsing and serialization are pure functions (`filters.ts`): corrupt or hand-edited URLs silently fall back to defaults, and default-valued fields are omitted so links stay clean. A store would just be a second thing to keep in sync.

**One filtered array feeds the map, table, and charts.** The page memoizes `sortEvents(filterEvents(events, filters))` once; every view renders that same array, so filtering can never make them disagree. Both the color/radius map styling and the table's magnitude badges are generated from a single magnitude scale (`magnitude.ts`) — the GPU interpolation expressions are derived from the same stops the JS color function uses, so a legend swatch and a map dot for a given magnitude are guaranteed identical.

**Real virtualization, measured.** The monthly feed can carry ~10k events. TanStack Table (headless) + TanStack Virtual render only the rows in view plus a small overscan — about **25 DOM row nodes instead of ~10,000**. Events render as a native MapLibre `circle` layer rather than DOM markers for the same reason: 10k absolutely-positioned nodes reprojected every frame would tank the frame rate; one GPU layer stays smooth.

**Pure diffing, shared with the future server.** New events are detected by a pure `detectNewEvents(prev, curr)` (a `Map`-indexed O(n+m) diff). Keeping "what counts as new" pure is the deliberate bridge to phase 2: the planned SSE route handler will run the _same_ function server-side to decide what to stream, so the definition never diverges. The notifier that wraps it resets its baseline when the feed changes and treats the first non-empty snapshot as a silent baseline, so switching feeds — or the initial load — never fires a flood of "new event" pulses/alerts.

**Resilient polling.** `useEarthquakes` polls every 60s via TanStack Query with retry/backoff. On a failed refetch it keeps the last good data visible and surfaces the error separately (stale-while-error) — the UI shows a retry banner instead of blanking out. A derived `connectionStatus` (`live` / `retrying` / `stale`) drives the header indicator.

**Alerts.** Users define "notify me at M≥X", optionally restricted to the current map viewport. Matching is a pure predicate (`matchesRule`) that is antimeridian-aware; rules persist to `localStorage` under a versioned, defensively-parsed schema. When the tab is hidden and permission is granted, a system Notification fires (click focuses the app and selects the event); when the tab is visible, an in-app toast shows instead. All four permission states (`default`/`granted`/`denied`/`unsupported`) have appropriate UI.

## Accessibility

The table is an ARIA `grid` with roving `tabindex` (arrow keys move focus, Enter/Space selects) and `aria-sort` on sorted headers. All icon-only controls have labels, the color palette meets WCAG AA contrast on the dark surfaces, alert toasts use an `aria-live` region, and every entry animation (map pulse and Recharts) is skipped under `prefers-reduced-motion`.

## Testing

84 unit tests (Vitest) cover the parts where correctness matters and behavior is subtle: the feed transform, the new-event diff, filter parse/serialize round-trips (including corrupt input), the pure filter/sort selectors (stability, nulls-last), the analytics binning/aggregation, alert rule matching (including the antimeridian case), the versioned storage parser (corrupt data), and the polling/notifier hooks (stale-while-error, `connectionStatus`, baseline reset).

The map and chart **components** are intentionally not render-tested: they need a real WebGL/canvas or layout context that jsdom doesn't provide, so a jsdom test would assert against mocks rather than real behavior. They're kept thin — all logic lives in the pure functions above — and are better verified in a browser/E2E layer, which is out of scope here.

## Roadmap

Server-side **SSE**: a route handler that fetches, diffs (same pure function), and streams only new events, collapsing the client to a thin subscription. A **region comparator** to watch and compare seismicity across several saved areas. And **PWA** packaging so alerts can work with the tab closed via a service worker.

## Deploy notes

Security headers (including a MapLibre-compatible CSP with `worker-src blob:`) are set in `next.config.ts`; metadata, an Open Graph / Twitter card (rendered at build via `next/og`), and a pulse-motif favicon are in place. See [`DEPLOY.md`](./DEPLOY.md) for the manual Vercel steps and the Lighthouse run.

---

Data courtesy of the U.S. Geological Survey; this project is not affiliated with or endorsed by the USGS.
