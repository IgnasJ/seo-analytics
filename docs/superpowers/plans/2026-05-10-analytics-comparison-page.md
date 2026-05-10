# Analytics Comparison Page

**Date:** 2026-05-10
**Status:** Planned (decided via grilling session, ready to implement)
**Author:** ijatulis@gmail.com

---

## Summary

A new `/analytics` page that lives in the sidebar between Dashboard and Domains. Compares all tracked websites side-by-side across three sections:

1. **Trend overlay charts** (primary, top of page) — three multi-line charts: Sessions, Clicks, Impressions. One coloured line per domain. Absolute scale; click-legend mutes individual domains.
2. **Leaderboard table** — 8-column sortable table: Domain, Category, Sessions, Bounce, Clicks, CTR, Position, Status. Default sort: Sessions DESC.
3. **Breakdown grid** — three horizontal stacked-bar charts: Channels, Countries, Devices. One row per domain showing share-of-traffic by source.

Date range and category filter chips at the top. URL-bound state (`?range=1m&category=2`) so views persist across reloads. All data already in cache — no new API calls.

---

## Decisions log (grilling session)

| # | Branch | Choice |
|---|---|---|
| 1 | Page primary job | Mixed sections (D), with trend overlay (B) given top-of-page real estate |
| 2 | Time range | Date range picker — same options as `/domain/[id]` (today/yesterday/7d/1m/90d/1y) |
| 3 | Domain scope | Category chip filter + per-line legend toggle (C) |
| 4 | Trend chart metrics | 3 charts: Sessions, Clicks, Impressions (B) |
| 5 | Y-axis scaling | Absolute, share Y-axis per chart (A) |
| 6 | Leaderboard columns | Domain · Category · Sessions · Bounce · Clicks · CTR · Position · Status |
| 7 | Breakdown chart shape | Horizontal stacked bars for all three (Channels, Countries, Devices) (B) |
| 8a | Sidebar placement | New top-level item between Dashboard and Domains; URL `/analytics` (A) |
| 8b | Domain colour palette | Hash-based assignment from a 12-colour palette so colours stay stable across sorts/filters/reloads (X — my recommendation, accepted by default) |
| 8c | Mobile | Render everything; let it scroll. Single-column trend charts, horizontally-scrollable leaderboard, full-width stacked bars (R — my recommendation, accepted by default) |

---

## Visual reference

```
Dashboard › Analytics

[ All (8/12) ] [ Client (4) ] [ Personal (3) ] [ Test (1) ]    [Today|Yesterday|7d|1m|90d|1y]

══════════════════════════════════════════════════════════════════════════════
TRENDS                                            (sticky anchor: #trends)

▌ Sessions over time
┌──────────────────────────────────────────────────────────────────────┐
│ ╱╲___╱╲╱─── domain-a.com    (blue)                                  │
│ ╱╲╱╲╱─────  client-b.com    (emerald)                               │
│ ___╱──────  photos.me       (amber)                                 │
└──────────────────────────────────────────────────────────────────────┘

▌ Clicks over time
[…three charts of identical shape…]

▌ Impressions over time
[…]

══════════════════════════════════════════════════════════════════════════════
LEADERBOARD                                        (anchor: #leaderboard)

DOMAIN              CATEGORY    SESSIONS  BOUNCE   CLICKS   CTR     POS    STATUS
domain-a.com        Client      12,400    42%      893     5.4%    3.2    🟢
client-b.com        Client       8,200    38%      127     6.1%    6.8    🟢
photos.me           Personal     4,100    51%       45     2.8%    9.1    🟡
test.io             Test           314    78%       12     1.6%   18.4    🔴

══════════════════════════════════════════════════════════════════════════════
BREAKDOWNS                                          (anchor: #breakdowns)

▌ Channels by share              (per-domain row, top categories segmented)
domain-a.com   ▓▓▓▓▓▓▓▓░░░░░░░▓▓░░░▓░    Direct/Organic/Referral/Social/Other
client-b.com   ▓▓░░░░░▓▓▓▓▓▓▓▓▓▓▓▓░░░░    
photos.me      ▓░░░░░▓░░▓▓▓▓▓▓▓▓▓▓▓▓▓▓    

▌ Countries by share             (top 5 + Other per row)
[…]

▌ Devices                        (3 fixed: desktop/mobile/tablet)
[…]
```

---

## Implementation plan

### Phase 1 — Skeleton page + nav

**New files:**
- `src/app/analytics/page.tsx` — server component, reads searchParams, queries every domain's `1m`-range cache, computes data structures for the three sections, renders.
- `src/components/analytics/page-anchors.tsx` (small) — sticky in-page anchor nav at top: `Trends · Leaderboard · Breakdowns` linking to `#trends` / `#leaderboard` / `#breakdowns`. Hides on mobile.

**Modified files:**
- `src/components/layout/sidebar.tsx` — insert new nav item after Dashboard, before Domains: `{ href: "/analytics", label: "Analytics", icon: BarChart3 }` (or `LineChart` from lucide).

### Phase 2 — Trend overlay charts

**New files:**
- `src/components/analytics/multi-domain-line-chart.tsx` — generic multi-line chart wrapper around recharts:
  - Props: `series: { domain: string; data: { date: string; value: number }[] }[]`, `metricLabel: string`, `metricColor: string` (currently unused — colours come from per-domain palette).
  - Auto-fit Y-axis (recharts default), one line per series via `<Line dataKey="…" stroke={domainColour}>`.
  - Legend at bottom; recharts' click-mute behaviour comes for free.
  - Inline Hint on the chart title explaining what the metric is and how absolute-scale comparison works.
- `src/components/analytics/domain-colour.ts` — `domainColour(id: number): string`, hash-based picker from a 12-element palette:
  ```
  blue · emerald · amber · violet · rose · cyan · lime · orange · pink · sky · teal · indigo
  ```
  Implementation: `palette[id % palette.length]`. Stable across sorts.

**Wiring in `/analytics/page.tsx`:**
- Build three series arrays — one per metric (Sessions, Clicks, Impressions).
- Each series array is `domains.map(d => ({ domain: d.hostname, data: d.daily.map(...) }))` from the relevant cached daily series.
- Pass to three side-by-side `<MultiDomainLineChart>` components stacked vertically.

### Phase 3 — Leaderboard table

**New file:**
- `src/components/analytics/leaderboard-table.tsx` — client component (needs sort state):
  - Reuses existing `SortHeader` from `top-pages-table.tsx` — already exported, already styled.
  - Columns: Domain (link to `/domain/[id]`) · Category (badge) · Sessions · Bounce · Clicks · CTR · Position · Status.
  - Sortable on every numeric column. Default: Sessions DESC.
  - Bounce rendered as percentage; CTR rendered as percentage; Position with one decimal; numeric formatting via `formatInteger` / `formatCompact`.
  - Status column: small status dot reusing `<StatusDot>` from `src/components/dashboard/status-dot.tsx` — same severity reasons (sync staleness, errors, unlinked, CWV poor, sitemap errors).
  - Row click navigates to `/domain/[id]`.

**Plumbing:**
- Compute every leaderboard cell server-side from already-cached data:
  ```
  sessions   = analytics1m.overview.sessions
  bounce     = analytics1m.overview.bounceRate
  clicks     = gsc1m.overview.totalClicks
  ctr        = gsc1m.overview.avgCtr
  position   = gsc1m.overview.avgPosition
  severity   = cardHealth(...)  // reuse existing helper
  ```

### Phase 4 — Breakdowns (channels / countries / devices)

**New file:**
- `src/components/analytics/share-bar-chart.tsx` — generic horizontal stacked-bar wrapper:
  - Props: `rows: { domain: string; segments: { name: string; value: number }[] }[]`, `topN?: number` (default no cap).
  - Each row's segments normalised: each segment's bar width = `(value / row total) × 100%`.
  - Top-N capping via the existing pattern from `country-chart.tsx` — surplus categories collapse to "Other."
  - One color per segment-name across rows so a category is the same colour in every domain's bar (palette: existing `country-chart` palette extended).
  - Legend at bottom; tooltip on hover shows absolute value + percentage.

**Per-breakdown configuration:**
- Channels — top 6 + Other (typical channel taxonomies have ~7 categories).
- Countries — top 5 + Other (matches per-domain `country-chart` choice for consistency).
- Devices — fixed 3 (desktop / mobile / tablet) — no Other needed.

**Sort order across all three breakdowns:** match the leaderboard's current sort. So if you've sorted leaderboard by Position, the breakdown rows appear in that same order. Visual continuity. Implemented by passing the sorted hostname order to the breakdown component.

### Phase 5 — Filters (chips + range picker)

**Modified files:**
- `src/app/analytics/page.tsx` — reads `?category=N&range=Xy` from searchParams, validates, applies filter to the domain list before passing to all three sections (trends, leaderboard, breakdowns). Re-uses validators from `src/lib/date-range.ts`.

**Reused components:**
- `<DashboardFilters>` from the dashboard — same chip row, same URL parameter shape (`?category=N&issues=1`). The `issuesOnly` toggle is opt-out for this page; if it doesn't make sense in an Analytics context, we can pass a prop to hide it (TBD during impl).
- `<DateRangePickerLink>` from `@/components/date-range-picker` — sits next to the filter chips.

### Phase 6 — Tests

- `src/components/analytics/__tests__/domain-colour.test.ts` — assert: same id always returns same colour; the palette has 12 entries; ids 0..11 map to distinct colours; id 12 wraps to id 0's colour.
- `src/components/analytics/__tests__/share-bar-chart.test.ts` — segment widths normalise to 100% across the row; top-N capping rolls surplus into "Other"; zero-row handling renders an empty-state message.

(Recharts wrapper components and the page itself are best validated visually rather than via unit tests — keep the test footprint modest.)

### Phase 7 — README

Brief paragraph in the README's Features section: "Cross-domain Analytics page — overlay trend charts for sessions, clicks, and impressions; sortable leaderboard; per-domain breakdowns of traffic channels, countries, and devices. All side-by-side comparisons with category filter and date range picker."

---

## Estimated scope

| Phase | New files | Modified | Lines | Realistic time |
|---|---|---|---|---|
| 1 — skeleton + nav | 2 | 1 | ~80 | 30 min |
| 2 — trend charts | 2 | 1 | ~180 | 2 hours |
| 3 — leaderboard table | 1 | 0 | ~150 | 2 hours |
| 4 — breakdowns | 1 | 1 | ~150 | 2 hours |
| 5 — filters | 0 | 1 | ~30 | 30 min |
| 6 — tests | 2 | 0 | ~80 | 1 hour |
| 7 — README | 0 | 1 | ~10 | 5 min |

Total: roughly **8 hours of focused work**.

---

## Out of scope (deferred)

- **Pairwise A vs B view (Q1 option E).** Different UX; revisit if you want a "redesign vs control" tool later.
- **Indexed Y-axis toggle.** Per Q5 — easy to add later if absolute-scale comparison feels insufficient.
- **CTR daily timeseries chart.** Per Q4 — derived metric, noisy on low-traffic days. The leaderboard's CTR column covers it as a window average.
- **Aggregate Lighthouse audit scores per domain.** Audits are per-URL; aggregating to domain-level needs a "most-recent audit per URL → average" step that's a separate small project.
- **Cross-page sticky filter state.** Each page (Dashboard, Analytics, /domain/[id]) reads its own URL params today. If you want the category chip to persist across navigations, that's a `localStorage` + URL-sync project.
- **Custom domain selection** beyond category chips (e.g., "show just these 3 specific domains"). The chip filter handles category-level subsetting; per-line legend mute handles single-domain hiding. A multi-select picker is a future flourish.

---

## Definition of done

- [ ] Sidebar shows `Dashboard | Analytics | Domains | Audit | Settings` (in that order).
- [ ] `/analytics` renders three sections in order: Trends, Leaderboard, Breakdowns.
- [ ] Date range picker in the page header; default `1m`. Changes propagate to all sections.
- [ ] Category chip filter visible above the trends section. Filter applies to every section. URL-bound (`?category=N&range=Xy`).
- [ ] Three trend charts (Sessions, Clicks, Impressions) render one line per domain. Same domain → same colour across the three charts (hash-based assignment from a 12-colour palette). Click a legend pill to mute that domain's line. Absolute Y-axis per chart.
- [ ] Leaderboard table has 8 columns; every numeric column is sortable; default sort is Sessions DESC. Each row links to `/domain/[id]`. Status column shows the same coloured dot + reasons tooltip as the dashboard cards.
- [ ] Three stacked-bar charts (Channels / Countries / Devices) render one row per domain in the same order as the leaderboard's current sort. Top-N capping where applicable. One colour per segment-name across rows.
- [ ] Mobile: page scrolls vertically; charts go full-width single-column; leaderboard scrolls horizontally on overflow.
- [ ] Sticky in-page anchor nav (`Trends · Leaderboard · Breakdowns`) appears at the top on viewports ≥ md.
- [ ] All existing tests pass; new tests for domain-colour stability and share-bar-chart math pass.
- [ ] `pnpm run build` succeeds; TypeScript clean.
