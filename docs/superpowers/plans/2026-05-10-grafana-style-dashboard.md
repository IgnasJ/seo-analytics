# Grafana-style Dashboard Redesign

**Date:** 2026-05-10
**Status:** Planned (decided via grilling session, ready to implement)
**Author:** [@IgnasJ](https://github.com/IgnasJ)

---

## Summary

Re-skin the dashboard at `/` from today's sparse 3-column card grid into a dense, Grafana-shaped stat-panel grid with:

- **4–5 compact cards per row** (was 3), each ~40% shorter than today.
- **Inline sparklines** on Sessions and Clicks (data already in cache).
- **Trend chip on Avg Position** (computed from cached daily data).
- **Status signal** as a coloured left border + dot, with the specific reasons for any non-green state surfaced via tooltip.
- **Sync time** moved out of the body text into a clock icon in the top-right of each card; tooltip shows the absolute timestamp and a "Sync now" action.
- **Optional KPI strip** above the grid, toggled by a `[Cards | Cards + KPI]` button. Aggregates Total Sessions, Total Clicks, Avg Position (impression-weighted), and "Healthy X of N" across all domains.

Categorical sections, the existing unlinked-services warning, and the per-card click-through to `/domain/[id]` are preserved.

---

## Decisions log (grilling session)

| # | Branch | Choice |
|---|---|---|
| 1 | Layout shape | Dense card grid (A) with optional KPI strip toggle (C) |
| 2 | Card content density | Rich compact: 3 metrics + sparklines (B) |
| 3 | Health signal | Coloured left border **and** status dot, tooltip lists specific reasons (A+B) |
| 4 | Specific metrics | Sessions sparkline / Clicks sparkline / Avg Position with ↑↓ trend chip (A) |
| 5 | KPI strip | 5a: strip + grid below (A). 5b: Total Sessions / Total Clicks / Avg Position (impression-weighted) / Healthy "X of N" (Set 3) |
| 6 | Sparkline style | Line + soft area fill, single accent color, no interactivity, auto-scale per card (B) |
| 7 | Toolbar | Minimal: title + view toggle + Add Domain. No filter chips / sort dropdown yet (A) |

---

## Visual reference

### Default view (cards only)

```
Dashboard                                  [Cards|+KPI]  + Add Domain
═════════════════════════════════════════════════════════════════════

CLIENT (2)
┌──────────────────────────┐ ┌──────────────────────────┐
┃● client-a.com         🕐 │ ┃● client-b.com         🕐 │
┃─────────────────────────│ ┃─────────────────────────│
┃ 12.4K sess     ╱╲___╱╲╱ │ ┃  8.2K sess     ╱╲___╱╲╱ │
┃   893 clk      ╱╱╲___╱╲ │ ┃   127 clk      ╱╲___╱╲╱ │
┃   3.2 pos      ↓ 0.3    │ ┃   6.8 pos      ↑ 0.4    │
└──────────────────────────┘ └──────────────────────────┘

PERSONAL (3)
┌──────────────────────────┐ ┌──────────────────────────┐ ┌──────────────────────────┐
┃⚠ test.io              🕐 │ ┃● blog.dev             🕐 │ ┃● photos.me            🕐 │
┃─────────────────────────│ ┃─────────────────────────│ ┃─────────────────────────│
┃   314 sess     ╲___╲_╱  │ ┃  4.1K sess     ╱╱╲_╱╱╲  │ ┃    52 sess     _╱╲_╱╲  │
┃    12 clk      ╲___╲_╱  │ ┃    45 clk      ╲╱╲_╱╲╱  │ ┃     3 clk      _╱╲___  │
┃  18.4 pos      ↑ 1.2    │ ┃   9.1 pos      ↓ 0.1    │ ┃   N/A pos               │
└──────────────────────────┘ └──────────────────────────┘ └──────────────────────────┘
 ↑                            ↑                            ↑
 amber border = unlinked      green border = healthy       green border = healthy
```

### KPI-toggle view (KPI strip + cards)

```
Dashboard                                  [Cards|+KPI*] + Add Domain
═════════════════════════════════════════════════════════════════════

┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│ TOTAL SESSIONS       │ │ TOTAL CLICKS         │ │ AVG POSITION         │ │ HEALTHY DOMAINS      │
│ 25.1K     ↑ 12%      │ │ 1.08K    ↑ 3%        │ │   7.2     ↓ 0.4      │ │   4 of 5             │
│ ╱╲___╱╲╱╲___╱╲╱     │ │ ╱╲___╱╲╱╲╱╲╱╲╱      │ │                      │ │ 1 needs attention    │
└──────────────────────┘ └──────────────────────┘ └──────────────────────┘ └──────────────────────┘

[same dense card grid as above, unchanged]
```

### Status signals

| Border / dot | Trigger condition |
|---|---|
| 🟢 green | All sources linked, last sync ≤24h, sync_log status=success, no CWV poor>25%, no sitemap errors |
| 🟡 amber | GA4 or GSC unlinked OR sync 24–48h old OR sync never ran |
| 🔴 red | Sync error in latest sync_log row OR sync >48h old OR CWV poor>25% on any metric OR sitemap errors |
| Card severity | max severity across all signals |

Hover the status dot → tooltip lists every active signal with timestamp.

### Sync icon

- Top-right corner of every card. Clock icon, muted color.
- **Tooltip on hover:**
  - "Synced 2h ago — 2026-05-10 11:24:33"
  - When error: "Last attempt failed 2h ago — 2026-05-10 09:14:01"
  - When never synced: "Never synced — click to sync now"
- **Click:** triggers a sync-this-domain request (`POST /api/domains/:id/sync`), shows a spinner over the icon while running, refreshes the page on completion. Same endpoint used by the existing per-domain Sync button on `/domain/[id]`.

---

## Implementation plan

### Phase 1 — Card visual refresh (foundation)

**New files:**
- `src/components/dashboard/sparkline.tsx` — pure SVG sparkline component (line + area fill, fixed accent color, auto-scaled, no interactivity). Props: `values: number[]`, `width?: number`, `height?: number`.
- `src/components/dashboard/status-dot.tsx` — small coloured dot with `Hint` tooltip listing reasons. Props: `severity: 'green'|'amber'|'red'`, `reasons: string[]`.
- `src/components/dashboard/sync-icon.tsx` — clock icon, tooltip with absolute + relative timestamp, click triggers `POST /api/domains/:id/sync` and shows spinner. Uses `formatDateTime()` for the absolute time.
- `src/components/dashboard/trend-chip.tsx` — small `↑ 0.4` / `↓ 1.2` / `—` chip. Color: green if movement is favourable for that metric (lower-is-better for position, higher-is-better for everything else), red if unfavourable, muted if change is below a small threshold (e.g., <2%).

**Modified files:**
- `src/components/domain-card.tsx` — rewrite layout. Drop the in-body "Synced Xh ago" line. Drop the in-body unlinked banner (move to status dot tooltip + amber border). Replace the 2-cell metrics grid with three rows of `<metric-number><sparkline>`. Add the status dot left-of-hostname and sync icon top-right. Compute severity via a new helper `cardSeverity(card)` colocated in the file.
- `src/lib/seo/health.ts` (new) — pure functions: `cardSeverity({ ga4Linked, gscLinked, lastSyncedAt, lastSyncStatus, issueCount }): { severity, reasons[] }`. Reasons array drives the tooltip; severity is `max` over the per-signal severities.

**Data plumbing:**
- `src/app/page.tsx` — extend `CardData` with:
  - `dailySessions: number[]` — last 30 days from `analytics.daily` (already cached, just exposed).
  - `dailyClicks: number[]` — from `gsc.daily`.
  - `position7d: number | null` — needed for the trend chip; reuse the existing `7d` cache range and pull `gsc.overview.avgPosition`.
  - `lastSyncStatus: 'success' | 'error' | null` — read most-recent sync_log row for this domain. Add a query `getLastSyncStatus(db, domainId)`.

### Phase 2 — Toolbar + view toggle (interactivity)

- `src/components/dashboard/view-toggle.tsx` — segmented `[Cards | Cards + KPI]` button. State persisted to `localStorage` (`dashboard-view-mode`); default to `cards`. Hydrates on the client only.
- `src/app/page.tsx` — top header rewritten: `<h1>Dashboard</h1>` on the left, `<ViewToggle/>` and `<AddDomainButton/>` on the right. Existing `+ Add Domain` link kept.
- The dashboard page becomes mixed: the grid remains server-rendered (data lookups are SSR), but the view-toggle and KPI strip are client-rendered conditionally.

### Phase 3 — KPI strip (aggregate panel)

- `src/components/dashboard/kpi-strip.tsx` — client component that takes the precomputed aggregates and renders 4 KPI tiles.
- `src/lib/seo/aggregates.ts` (new) — pure functions:
  - `sumDaily(arrays: number[][]): number[]` — element-wise sum across domains.
  - `weightedAvgPosition(domains: Array<{ position: number, impressions: number }>): number` — `Σ(p × i) / Σ(i)`.
  - `healthyCount(severities: Array<'green'|'amber'|'red'>): { healthy: number, total: number }`.
- `src/app/page.tsx` — when in `cards+kpi` mode, compute the aggregates server-side and pass to `<KpiStrip/>`. The strip renders only when toggle is on (CSS toggle, not separate render path, so no re-fetch).

### Phase 4 — Mobile + accessibility polish

- Grid breakpoints: `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3`. Was `1 / 2 / 3 / 3` → now denser at every breakpoint.
- Status dot tooltip uses the `Hint` helper from `src/components/ui/hint.tsx` for consistent zero-delay tooltip behaviour.
- Sparkline `<title>` element inside SVG carries the metric label + total value as a screen-reader fallback (since the visual is small and there's no hover tooltip).
- Sync icon button has `aria-label="Sync now"` and explicit hit-target padding so the touchable area is ≥44 px on mobile.

### Phase 5 — Tests

- `src/lib/seo/__tests__/health.test.ts` — `cardSeverity` against fixtures: all-green, GA4-only-unlinked, sync-never-ran, sync-error-newest, sync-stale-25h, sync-stale-49h, sitemap-errors, CWV-poor-30%. ~10 cases.
- `src/lib/seo/__tests__/aggregates.test.ts` — `sumDaily` length normalisation, `weightedAvgPosition` impression-weighted math vs unweighted (proves it's actually weighted), `healthyCount` empty / all-green / mixed.
- `src/components/dashboard/__tests__/sparkline.test.ts` — render-shape only: passes for non-empty data, returns null/dashed for all-zero data, scales path d-attribute correctly.

### Phase 6 — README update

Brief paragraph on the new dashboard layout in the Features list. No env or setup changes needed.

---

## Estimated scope

| Phase | New files | Modified files | Lines | Realistic time |
|---|---|---|---|---|
| 1 — visual refresh | 4 | 2 | ~400 | 1 day |
| 2 — toolbar + toggle | 1 | 1 | ~80 | 1 hour |
| 3 — KPI strip | 1 + helpers file | 1 | ~150 | 3 hours |
| 4 — mobile polish | 0 | 2 | ~30 | 1 hour |
| 5 — tests | 3 | 0 | ~200 | 2 hours |
| 6 — README | 0 | 1 | ~15 | 10 min |

Total: roughly **1.5–2 working days**.

---

## Explicitly out of scope (deferred)

- **Dark mode.** Tailwind v4 + shadcn already wires the variables; flipping the theme is a separate ~half-day effort. Worthwhile but doesn't block this redesign.
- **Sort dropdown / category chip filter** in the toolbar. Adds value once you have ≥10 domains; you have <5. Build only when scaling pain is real.
- **Per-metric color thresholds** (Position >20 = red, etc.). The card-level status signal already covers "is this domain in trouble"; per-metric coloring would compete with the sparklines.
- **Hover sparklines.** Tiny size makes tooltips fight for anchor space. Click → per-domain detail page is enough.
- **Customisable card metrics.** Sessions / Clicks / Position is opinionated. If a user wants different metrics, they go to per-domain detail page. Don't build a metric picker.

---

## Definition of done

- [ ] Dashboard renders 4–5 cards per row at `lg`+, 3 at `md`, 2 at `sm`, 1 at `xs`.
- [ ] Each card shows hostname, status dot, sync clock icon, three metric rows (Sessions+sparkline / Clicks+sparkline / Position+trend chip).
- [ ] Coloured left border and matching status dot reflect the card's severity per the table above.
- [ ] Hovering the status dot opens a tooltip listing every active signal with relative timestamps where applicable.
- [ ] Hovering the sync clock shows the absolute timestamp; clicking it triggers a sync, shows a spinner, and refreshes the page on completion.
- [ ] `[Cards | Cards + KPI]` toggle in the page header works, persists across reloads via localStorage, defaults to `cards`.
- [ ] When toggled to `Cards + KPI`, four aggregate tiles render above the grid: Total Sessions (sparkline), Total Clicks (sparkline), Avg Position (impression-weighted, with delta chip), Healthy domains "X of N" with breakdown subtitle.
- [ ] All existing tests pass; ~15 new tests for `health`, `aggregates`, and `sparkline`.
- [ ] `pnpm run build` succeeds. TypeScript clean.
- [ ] Mobile (375 px viewport) renders single-column cards with no horizontal scroll; sync icon hit target ≥44 px.
