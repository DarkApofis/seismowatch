# Deploy checklist (Vercel)

Everything code-side is ready. The remaining steps are manual and account-specific.

## 1. Connect the repo

1. Push this repository to GitHub/GitLab.
2. In Vercel, **New Project → Import** the repo. Framework preset **Next.js** is detected automatically; the build command (`next build`) and output are the defaults — no changes needed.
3. Deploy. Vercel serves the static output plus the `next/og` image routes.

## 2. Environment variables

- `NEXT_PUBLIC_SITE_URL` → your production URL (e.g. `https://seismowatch.vercel.app`). Used for `metadataBase` and the Open Graph/Twitter absolute URLs. Falls back to a placeholder if unset, so the app still builds without it.

## 3. Verify after first deploy

- Open the site: the map should load Carto tiles and the USGS feed (check the browser console for CSP violations — none expected; the CSP in `next.config.ts` allows `basemaps.cartocdn.com`, `earthquake.usgs.gov`, and `worker-src blob:` for MapLibre).
- Confirm response headers include `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- Share a filtered URL (e.g. `/?mag=4.5&window=week&minMag=5`) and confirm the view restores.
- Paste the deploy URL into a link unfurl (Slack/Twitter) or open `/opengraph-image` to confirm the OG card renders.

## 4. Lighthouse

Run against the **production** build, not dev:

```bash
pnpm build && pnpm start          # http://localhost:3000
npx lighthouse http://localhost:3000 --view --preset=desktop
```

Targets: Performance ≥ 95, Accessibility = 100. Notes on choices already made toward these:

- **Performance:** Recharts (~40 kB gzip) is code-split — the charts and their dependency load only when the Analytics panel is expanded, keeping the initial First Load JS ~140 kB. MapLibre is a lazy (`ssr: false`) chunk. Fonts use `next/font` (self-hosted, `display: swap`).
- **Accessibility:** `--text-muted` was lightened to clear WCAG AA contrast (~6:1) on the dark surfaces; the table is a keyboard-navigable ARIA grid; all icon buttons have labels.

> Not run in the CI sandbox (Lighthouse needs a real Chrome). Run it once locally/after deploy and, if anything dips below target, the two levers above are where to look.

## 5. Optional polish

- Add `docs/screenshot.png` and reference it at the top of the README.
- Set a custom domain in Vercel and update `NEXT_PUBLIC_SITE_URL`.
