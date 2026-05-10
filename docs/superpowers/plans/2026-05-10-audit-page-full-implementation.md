# SEO Audit page — full implementation

**Date:** 2026-05-10
**Status:** Planned (decided via grilling session, ready to implement)
**Author:** [@IgnasJ](https://github.com/IgnasJ)

---

## Summary

Turns the current "single page with paste-URL form + flat history" into a multi-feature audit hub:

- **`/audit`** stays the daily-flow page: paste-URL/batch form on top, new collapsible **cross-URL summary card** in the middle (KPI tiles + worst-pages + common-failures), upgraded **history list** at the bottom (filter/sort/search bar + flat/grouped toggle + URL-bound state + pagination).
- **`/audit/url?u=<url>`** (new dedicated route) — every audit ever run for one URL, with two trend charts (4 category scores; lab CWV), an audit-pair selector for diff-any-two, screenshot strip from PSI's response, and an "Audit now" button + tracked-domain badge.
- **`/domain/[id]`** gets a 5th tab "Audits" — list of audits on that domain plus an **"Audit top N pages"** button that batches the GSC-top pages.
- **Audit form** gets a small `[Mobile | Desktop]` strategy toggle (default mobile, opt-in desktop).
- **`<AuditDetail>` upgrades** — failing entries sort by impact (savings DESC); severity filter chips; savings shown inline.

All powered by existing data — no new external API integrations. Transform layer extends to keep PSI's screenshot, savings estimates, and strategy.

---

## Decisions log (grilling session)

| # | Branch | Choice |
|---|---|---|
| 1 | Tool primary mode | B + C-flavoured: multi-section hub with domain integration |
| 2 | URL-detail location | A: dedicated `/audit/url?u=…` route |
| 3a | URL-detail header | C: title + tracked-domain badge + "Audit now" button + view-on-domain link |
| 3b | URL-detail trend charts | D: two charts — 4 score lines + 5 lab-CWV lines |
| 3c | Audit pair selector | A: explicit checkboxes; default newest two pre-selected |
| 3d | URL-detail extras | Screenshot strip only (defer common-failures-per-URL, mobile/desktop side-by-side) |
| 4 | Cross-URL summary card | D: KPI strip + Worst pages list + Common failures list (side-by-side) |
| 5 | History list | C: filter bar + `[Flat | Grouped by URL]` toggle, URL-bound state, paginated |
| 6 | Domain integration | A: new "Audits" tab on `/domain/[id]` with "Audit top N pages" button |
| 7 | Mobile vs Desktop | D: opt-in desktop via toggle on the audit form; URL-detail tabs `[Mobile | Desktop]` |
| 8 | Per-audit detail upgrades | A + B + E: impact-sort failing entries; severity filter chips; inline savings |

---

## Implementation plan

### Phase 1 — Schema + transform extensions

**Schema migration** (idempotent in `runMigrations`):
- `audits.strategy TEXT NOT NULL DEFAULT 'mobile'` — track whether each audit was mobile or desktop.

**Transform** (`src/lib/audit/transform.ts`):
- Extend `AuditEntry` with `numericSavings: number | null` (ms or KiB depending on the audit).
- Capture `details` from PSI's audit blocks for displaying selectors later (kept on disk; used in Phase 4+).
- Capture top-of-response screenshot from `lighthouseResult.audits["final-screenshot"].details.data` (data-URL string). Persist on `AuditResult.screenshot: string | null`.
- Add `AuditResult.strategy: "mobile" | "desktop"` so URL-detail can split lines per strategy.

**PSI request** (`src/lib/audit/psi.ts`):
- Already accepts `strategy` arg; surface it through `runAudit`.

### Phase 2 — `/audit/url` page (the new headline feature)

**New files:**
- `src/app/audit/url/page.tsx` — server component, takes `?u=<encoded-url>` from search params, queries every audit row for that URL, renders header + charts + pair selector + diff.
- `src/components/audit/url-header.tsx` — title (the URL), small "tracked domain" `Badge` if hostname matches a row in `domains`, "Audit now" button (POSTs to `/api/audit` with the URL + strategy and refreshes), "View on domain" link.
- `src/components/audit/url-score-chart.tsx` — multi-line chart with 4 series (Performance / A11y / Best Practices / SEO), x-axis = audit timestamps. Reuses `useLegendVisibility`.
- `src/components/audit/url-cwv-chart.tsx` — multi-line chart with up to 5 series (LCP / CLS / TBT / FCP / SI). CLS uses a separate Y-axis or its own chart due to scale mismatch.
- `src/components/audit/audit-pair-selector.tsx` — table of audits with two checkbox columns (`A` / `B`) so the user picks any two; default checks newest two; `Compare` action below renders `<AuditDetail current={B} prior={A} />`. Uses the existing `<AuditDetail>` component.
- `src/components/audit/screenshot-strip.tsx` — horizontal scroll of audit thumbnails (one per audit), labelled with timestamp; clicking opens a larger lightbox or just navigates the diff to that audit.

**Strategy tabs:** if both `mobile` and `desktop` audits exist for the URL, the page renders a top-level `Tabs` with two values; default to whichever strategy the most-recent audit used.

**New query** (`src/lib/db/queries/audits.ts`): `listAuditsForUrl(db, url)` returns every audit ever run on a URL.

### Phase 3 — `/audit` upgrades

**Cross-URL summary card** (collapsible, default closed):
- New file `src/components/audit/summary-card.tsx`:
  - **KPI strip** (4 tiles, inline like the dashboard's KPI strip): total audits in window, average Performance, average SEO, % audits failing (any category < 50). Window = last 30 days by default.
  - **Worst pages** list (5 rows): URL, Performance, SEO; sortable by Performance / SEO / overall. Each row → `/audit/url?u=…`.
  - **Common failures** list (5 rows): aggregates `(audit_id, count)` across the last N done audits; sortable by count / category. Click a row → "show me audits where this fails" (a filter applied to history below).
- Aggregates computed server-side in `/audit/page.tsx`:
  - New helper `src/lib/audit/aggregates.ts`: `summariseAudits(rows: Audit[]): AuditSummary` — pure function over parsed `result_json`s.

**History list upgrades:**
- Filter bar at top: search input (URL substring), status `[All | Done | Error | Pending]`, date `[Last 7d | 30d | 90d | All]`. URL-bound (`?q=…&status=…&since=…`).
- Mode toggle: `[Flat | Grouped by URL]`. URL-bound (`?view=grouped`). Default flat.
  - Flat: existing rendering, paginated.
  - Grouped: one row per distinct URL with audit count + latest scores; click → `/audit/url?u=…`.
- Pagination via existing `<PageNav>`, 20 entries per page.
- New backend route or query: `listAuditsFiltered(db, opts)` accepting search string, status, since-timestamp, limit, offset. Returns total + page for the pager.

**Audit form** (top of page):
- Strategy toggle: `[Mobile | Desktop]` segmented button next to the URL input. Default mobile. Persists in URL or localStorage (lean toward localStorage since this is an input preference).

### Phase 4 — `<AuditDetail>` content upgrades

`src/components/audit/audit-detail.tsx`:
- Severity filter chips at top: `All · Failing · Warnings · Passed`. URL-bound on the URL-detail page; component-state on the inline expansion.
- Within each category, sort entries by **failing first**, then **savings DESC** within the failing bucket. Diagnostic / passed entries below by display title.
- Render `displayValue` and (when present) `numericSavings` as a green/amber pill next to the entry title — "Potential 1.2 s saved" / "Potential 84 KiB saved".

### Phase 5 — `/domain/[id]` Audits tab

`src/app/domain/[id]/page.tsx`:
- Add 5th tab `Audits`.

**New components:**
- `src/components/domain/domain-audits-tab.tsx`:
  - Header: count, last-audit timestamp, **"Audit top N pages"** button (default N=10, configurable).
  - List: filtered `audits` rows where `url` host matches the domain's hostname, paginated. Same row shape as `/audit`.

**Wiring "Audit top N pages":**
- New API route `POST /api/domains/:id/audit-top-pages` — reads `gsc.topPages` from cache, takes top-N by clicks, calls the existing audit creation path once per URL, returns `{ ids: number[] }`.
- Client tab refreshes the list after the call and shows pending audits as they progress (reuses the existing `/api/audit` polling pattern).

### Phase 6 — Tests

- `src/lib/audit/__tests__/aggregates.test.ts` — `summariseAudits` correctness: empty, mixed scores, common-failures aggregation across multiple audits.
- `src/lib/audit/__tests__/transform.test.ts` — extend with: numericSavings extraction, screenshot extraction, strategy passthrough.
- `src/lib/db/__tests__/audits.test.ts` — extend with: `listAuditsForUrl` returns ordered by requested_at DESC; filtered listing pages correctly.

### Phase 7 — README

A paragraph in the Features section describing the audit hub. No env or setup changes.

---

## Visual reference

```
═══ /audit ═══════════════════════════════════════════════════════════
Dashboard › Audit                                          [Mobile|Desktop]
[ paste URL                                          ] [ Audit ▼ batch ]

▼ Audit summary  (24 audits · Perf 67 avg · SEO 92 avg · 8 failing)

   Worst pages              Common failures
   /blog/x      P:34        Image alt missing       9 pgs
   /products/y  P:48        Meta description        7 pgs
   /about       P:55        Unused CSS              5 pgs
   ...                      ...

═══ History ══════════════════════════════════════════════════════════
[search...]  [All ▼]  [30d ▼]                            [Flat | Grouped]

✓ https://client.com/blog/x   P 34  S 92   2026-05-10 13:06   →
⚠ https://client.com          ...                            →
○ pending  https://photos.me  ...                            →
                                       ◀  Page 2 of 5  ▶

═══ /audit/url?u=https://client.com/blog/x ═══════════════════════════
Dashboard › Audit › client.com/blog/x        [Audit now]  [View domain →]
                                              [Mobile | Desktop]

[ Scores over time chart      ]   [ Lab CWV over time chart ]
P/A/BP/S × 12 audits             LCP/CLS/TBT/FCP/SI

[Audit list with checkbox columns A | B]
☑ A    2026-05-10 13:06   P 34  S 92  ...
☑ B    2026-05-09 09:12   P 67  S 90  ...
□      2026-05-01 11:22   ...

[Compare A vs B] → renders <AuditDetail current={B} prior={A} />

[Screenshot strip — small thumbnails, latest right-most]

═══ /domain/[id] · Audits tab ════════════════════════════════════════
12 audits · last 2026-05-10 13:06    [Audit top 10 pages]

Same row shape as /audit history, filtered to this domain.
```

---

## Estimated scope

| Phase | New files | Modified | Lines | Realistic time |
|---|---|---|---|---|
| 1 — schema + transform | 0 | 3 | ~80 | 1 hour |
| 2 — `/audit/url` route | 5 | 0 | ~500 | half a day |
| 3 — `/audit` upgrades | 2 | 1 | ~350 | half a day |
| 4 — `<AuditDetail>` upgrades | 0 | 1 | ~100 | 1 hour |
| 5 — domain Audits tab | 1 + 1 route | 1 | ~200 | 2 hours |
| 6 — tests | 1 | 2 | ~150 | 1.5 hours |
| 7 — README | 0 | 1 | ~10 | 5 minutes |

Total: roughly **1.5–2 working days**.

---

## Out of scope (deferred per Q3d / Q8)

- **Common failures *per URL* on the URL-detail page.** Better served by the cross-URL summary card on `/audit`.
- **Lighthouse Opportunities/Diagnostics regrouping.** Conflicts with existing per-category UI; revisit if user feedback wants it.
- **Element-selector evidence per audit entry** (e.g. "image-alt fails on `<img class=hero>`"). Worth doing once the rest stabilises — the transform work to extract `details.items` is non-trivial.
- **Schedule audits / cron / alerts.** Per the original audit plan: needs a daemon and notification surface.
- **Sitemap-driven full-site crawl.** Different rate-limiting model; outside this plan.

---

## Definition of done

- [ ] Audit form on `/audit` has a `[Mobile | Desktop]` strategy toggle; default mobile; submitted strategy persists per-audit.
- [ ] `audits.strategy` column exists in the DB; existing rows default to mobile.
- [ ] PSI screenshot is captured into `result_json`; old audits without screenshot render gracefully.
- [ ] Cross-URL summary card on `/audit` collapses by default; expanded shows KPI tiles + worst pages + common failures.
- [ ] History on `/audit` has a search input, status / date filter chips, flat/grouped toggle, and pagination. State is URL-bound.
- [ ] Clicking any URL in history (or in a summary list) navigates to `/audit/url?u=…`.
- [ ] `/audit/url` renders: URL header with re-audit + view-on-domain, two trend charts, audit list with pair selector and compare action, screenshot strip.
- [ ] `<AuditDetail>` has severity filter chips and sorts failing entries by `numericSavings` DESC; failing entries show inline savings pills.
- [ ] `/domain/[id]` has an Audits tab listing audits for that domain with an "Audit top N pages" button that batches the top-clicked URLs.
- [ ] All existing tests pass; new tests for aggregates + transform + queries pass.
- [ ] `pnpm run build` succeeds; TypeScript clean.
