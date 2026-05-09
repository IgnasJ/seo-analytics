# Domain Categories + SEO Audit Tool

**Date:** 2026-05-10
**Status:** Planned (decided via grilling session, ready to implement)
**Author:** ijatulis@gmail.com

---

## Summary

Two parallel feature tracks built on top of the existing analytics dashboard:

1. **Domain organization.** Add a normalized `categories` table, a dedicated `/domains` admin tab (replacing domain management currently mashed into `/settings`), and a category-grouped dashboard view.
2. **SEO audit tool.** New `/audit` standalone page where the user pastes any URL and gets a Lighthouse-style on-page SEO checkup (PageSpeed Insights + cheerio HTML parsing). Audits are saved to SQLite for history and inline diff comparison on re-audit. Async durable: pasted audits run as background promises and surface in the history list when complete.

Both tracks ship in two phases:

| Phase | Track 1: Domains | Track 2: Audit |
|---|---|---|
| **v1** (primary delivery) | Categories CRUD, `/domains` tab, dashboard sections | Single-URL audit, PSI-only, save + diff, Lighthouse UI |
| **v1.1** (incremental) | — | Paste list of URLs → batched into history list |
| **deferred** | — | Per-domain "top N pages from GSC" button (v1.2); sitemap-driven crawl, scheduled audits, custom cheerio rules |

---

## Decisions made (grilling log)

Each decision in this plan was selected explicitly during a grilling session. Quoted is the chosen option from each branch.

**Audit tool track:**

- **Q1 Scope of analysis:** *On-page (technical + content), no off-page / paid backlink APIs.* Cost: $0.
- **Q2 Single-URL or bulk:** *Single-URL for v1.* Bulk crawl planned for v1.1.
- **Q3 Render mode:** *Static HTML via `cheerio`.* No headless browser. If page looks suspiciously empty after fetch, surface a "may be JS-rendered" warning instead of forcing Chromium into the container.
- **Q4 Data sources:** *PSI + cheerio, PSI-first.* MVP calls PageSpeed Insights only. Cheerio rules layered in iteratively once we know what PSI doesn't cover.
- **Q5 UI placement:** *Standalone `/audit` page, no domain coupling.* Audit any URL, including non-tracked competitors. (Domain-aware augmentation explicitly rejected for v1.)
- **Q6 Persistence:** *Save every audit + design schema for diff.* Every audit goes into SQLite. JSON shape is flat-keyed so a side-by-side diff is trivially derivable.
- **Q7 Latency UX:** *Async durable.* `POST /api/audit` returns immediately with an id; the audit runs as a background promise; the history list on `/audit` shows status badges (pending/done/error). Tab can close, audit completes regardless.
- **Q8 Result rendering:** *Lighthouse-style.* Four circular score gauges (Perf / A11y / Best Practices / SEO) at top, collapsible category sections below. Inline deltas when prior audit of the same URL exists.

**Domain organization track:**

- **Q9 Category model:** *Single category per domain.* Not multi-tag.
- **Q10 Category storage:** *Normalized table with CRUD.* Not free-form text column.
- **Q11 Required vs optional:** *System-defaulted with seeded `Uncategorized`.* `category_id INTEGER NOT NULL DEFAULT 1`. The `Uncategorized` category (id=1) is undeletable; deleting any other category auto-reassigns its domains to it.
- **Q12 Tab structure:** *Three tabs: Dashboard / Domains / Settings.* Domains gets concrete naming; Settings keeps OAuth and future app prefs.
- **Q13 Dashboard layout:** *Sectioned vertical scroll.* One header per category, 3-column grid below. Empty categories hidden. No filter chips, no sidebar tree.

**Roadmap (Q14):**

- *Phase 1 (v1):* single-URL audit (above).
- *Phase 2 (v1.1):* paste-list batch audit using the same engine.
- *Deferred:* per-domain "audit top N pages" (C); sitemap-driven full-site crawl (B); scheduled cron audits (D).

---

## Implementation plan

### Phase 1 — Domain categories (track 1, v1)

**Schema migrations.** Existing schema uses `CREATE TABLE IF NOT EXISTS` with no migration system. To add categories without wiping data:

1. Add to `SCHEMA_SQL` in `src/lib/db/schema.ts`:
   ```sql
   CREATE TABLE IF NOT EXISTS categories (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL UNIQUE,
     sort_order INTEGER NOT NULL DEFAULT 0,
     is_system INTEGER NOT NULL DEFAULT 0,
     created_at INTEGER NOT NULL DEFAULT (unixepoch())
   );

   INSERT OR IGNORE INTO categories (id, name, sort_order, is_system)
     VALUES (1, 'Uncategorized', 999, 1);
   ```
2. Add `category_id` to `domains`. Because SQLite can't add a NOT NULL column with a default referencing another table on `ALTER TABLE` cleanly, do it in `getDb()` after the schema runs:
   ```ts
   // src/lib/db/index.ts — after db.exec(SCHEMA_SQL):
   const cols = db.query<{name: string}, []>("PRAGMA table_info(domains)").all()
   if (!cols.find(c => c.name === "category_id")) {
     db.exec(`
       ALTER TABLE domains ADD COLUMN category_id INTEGER NOT NULL DEFAULT 1
         REFERENCES categories(id);
     `)
   }
   ```
   Existing `nemokamatv.lt` row gets `category_id=1` (Uncategorized) automatically via the DEFAULT.

**Backend.**

- `src/lib/db/queries/categories.ts` — CRUD: `listCategories`, `createCategory`, `renameCategory`, `reorderCategories`, `deleteCategory`. `deleteCategory` runs `UPDATE domains SET category_id=1 WHERE category_id=?` first, then deletes the row. Block deletion of `is_system=1`.
- `src/app/api/categories/route.ts` — `GET` (list) + `POST` (create).
- `src/app/api/categories/[id]/route.ts` — `PATCH` (rename / sort_order) + `DELETE`.
- Update `src/lib/db/queries/domains.ts`:
  - `Domain` interface gains `category_id: number`.
  - `addDomain` accepts optional `categoryId` (defaults to 1).
  - New `updateDomainCategory(db, id, categoryId)`.

**Frontend.**

- New page `src/app/domains/page.tsx` (renamed from settings flow). Two stacked cards:
  1. **Categories** — table of categories with rename / delete / drag-to-reorder. "+ Add category" inline form. The `Uncategorized` row shows greyed out with delete disabled.
  2. **Domains** — current domain table from `/settings`, plus a Category column with a dropdown to reassign. Discover-properties + delete actions stay.
- Slim `src/app/settings/page.tsx` to just the Google OAuth card + a stub "More app preferences coming soon."
- Sidebar update in `src/components/layout/sidebar.tsx` (or wherever nav lives): add "Domains" link between Dashboard and Settings.
- Dashboard `src/app/page.tsx` rewrite:
  - Fetch categories ordered by sort_order; for each category, fetch domains where category_id matches.
  - Render `<section>` per category with a header and the existing 3-column DomainCard grid.
  - Hide categories with zero domains.
  - Default sort: by `sort_order` ASC, ties broken by `name`. Move `Uncategorized` to the bottom (its sort_order=999).

**Tests.**

- `src/lib/db/__tests__/categories.test.ts` — CRUD round-trip, system category undeletable, delete reassigns domains to id=1.
- `src/lib/db/__tests__/schema.test.ts` — extend to verify the `category_id` column exists with the right default.

---

### Phase 2 — SEO Audit v1 (track 2, single URL)

**Environment.**

Add to `.env.example`:
```
PSI_API_KEY=<Google Cloud API key with PageSpeed Insights API enabled>
```
Can be the same key as `CRUX_API_KEY` if both APIs are enabled in the same Cloud project — but a separate key is cleaner for quota visibility.

**Schema.**

Add to `SCHEMA_SQL`:
```sql
CREATE TABLE IF NOT EXISTS audits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | running | done | error
  requested_at INTEGER NOT NULL DEFAULT (unixepoch()),
  completed_at INTEGER,
  result_json TEXT,                        -- AuditResult shape (see below)
  error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_audits_url ON audits(url, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_audits_status ON audits(status, requested_at DESC);
```

**`AuditResult` JSON shape (flat-keyed for trivial diff):**

```ts
interface AuditResult {
  fetchedUrl: string
  finalUrl: string  // after redirects
  scores: {
    performance: number  // 0-100
    accessibility: number
    bestPractices: number
    seo: number
  }
  labCwv: {
    lcp: number  // milliseconds
    cls: number
    tbt: number
    fcp: number
    si: number
  }
  fieldCwv: { lcp: CwvMetric | null; cls: CwvMetric | null; inp: CwvMetric | null }
  audits: Array<{
    id: string                // stable Lighthouse audit id, e.g. "image-alt"
    title: string
    description: string
    score: number | null      // 0-1, or null for informational
    displayValue?: string
    category: "performance" | "accessibility" | "best-practices" | "seo"
    severity: "pass" | "warn" | "fail"
  }>
  // v1.1+: cheerioFindings: Array<{...}>
}
```

**Backend.**

- `src/lib/audit/psi.ts` — single function `fetchPSI(url, apiKey): Promise<RawPSIResponse>`. Calls `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=...&strategy=mobile&category=performance&category=accessibility&category=best-practices&category=seo`. 60s timeout via `AbortSignal`.
- `src/lib/audit/transform.ts` — `transformPsi(raw): AuditResult`. Maps PSI's nested response into our flat shape.
- `src/lib/audit/runner.ts`:
  ```ts
  export async function runAudit(auditId: number): Promise<void> {
    const db = getDb()
    setAuditStatus(db, auditId, "running")
    try {
      const audit = getAudit(db, auditId)!
      const raw = await fetchPSI(audit.url, process.env.PSI_API_KEY!)
      const result = transformPsi(raw)
      setAuditResult(db, auditId, result)
    } catch (err) {
      setAuditError(db, auditId, err instanceof Error ? err.message : String(err))
    }
  }
  ```
- **Concurrency guard.** PSI's QPS limit means we need at most 1 audit running at a time. Simple in-memory mutex:
  ```ts
  // src/lib/audit/queue.ts
  let queue = Promise.resolve()
  export function enqueue(fn: () => Promise<void>): void {
    queue = queue.then(fn).catch(() => {})
  }
  ```
  Route handler does `enqueue(() => runAudit(id))` — no await — and returns the id immediately.
- `src/lib/db/queries/audits.ts` — `createAudit(url)`, `getAudit(id)`, `setAuditStatus`, `setAuditResult`, `setAuditError`, `listAudits(limit)`, `getLastCompletedAudit(url, beforeId)` (for diff lookup).

**Routes.**

- `POST /api/audit` — body `{ url: string }`. Validates URL, normalizes (trim, ensure protocol), inserts row with status=pending, enqueues `runAudit`, returns `{ id }`.
- `GET /api/audit/:id` — returns full audit row.
- `GET /api/audit` — returns last 50 audits (history list, ordered by `requested_at DESC`).

**Frontend.**

- New page `src/app/audit/page.tsx`:
  - Top: single URL input + "Audit" button. Disabled while a request is in-flight.
  - Below: history list. Each row: URL, timestamp, status badge (pending=spinner, running=spinner, done=✓ green, error=✗ red), overall scores as 4 mini-pills. Click a row to expand its full result inline.
  - Polling hook: while any visible audit is `pending` or `running`, refetch `/api/audit` every 2s. Stop polling when no in-flight rows remain.
- New component `src/components/audit/lighthouse-gauges.tsx` — four circular score rings, color-coded (red <50, orange 50–89, green ≥90). Use plain SVG to avoid pulling in another chart lib (recharts is overkill for a circle).
- New component `src/components/audit/audit-detail.tsx` — collapsible category sections; each lists failing audits with title + description + value. Look up `getLastCompletedAudit(url, currentId)` server-side, pass into the detail component as `prior?: AuditResult`. If `prior` is non-null, render delta badges next to each score and lab-CWV value.
- Sidebar: add "Audit" link between Dashboard and Domains.

**Tests.**

- `src/lib/audit/__tests__/transform.test.ts` — feed a captured PSI JSON fixture, assert `AuditResult` shape and a few key field mappings.
- `src/lib/audit/__tests__/queue.test.ts` — verify mutex serializes promises.
- `src/lib/db/__tests__/audits.test.ts` — CRUD + `getLastCompletedAudit` returns the right row when multiple exist for one URL.

---

### Phase 3 — SEO Audit v1.1 (paste list)

After v1 is solid, this is small.

- Same `/audit` page, replace single input with a textarea (one URL per line). "Audit all" button.
- New route `POST /api/audit/batch` — accepts `{ urls: string[] }`, validates each, creates a row per URL with status=pending, enqueues each onto the same queue. Returns `{ ids: number[] }`.
- History list naturally shows the batch as separate rows; the queue serializes execution.
- Optional small UX nicety: show a "Batch of N" group label above the most recent N audits if they were submitted within ~10s of each other. Pure presentation, no schema change.

---

## Deferred / explicitly out of scope

- **Per-domain "audit top N pages" button (C from Q14).** v1.2 candidate. Reuses the engine; needs a "fetch top pages from GSC cache" helper and a button on `/domain/[id]`.
- **Sitemap-driven full-site crawl (B from Q14).** Requires per-day audit caps, dedupe-by-recency ("skip if audited within last 7 days"), and probably a separate "site audit" page that displays N audits as a table with sort/filter. Don't build until you've used v1 + v1.1 enough to know what shape "site audit" should take.
- **Scheduled audits with notifications (D from Q14).** Requires a daemon, a notification channel (email? Slack webhook?), and a "what changed since last run" report. Far down the road.
- **Custom cheerio rules.** Defer until you've used PSI on real URLs and identified specific gaps. Don't pre-build.
- **Off-page / backlink audits (B from Q1).** Requires paid API; explicitly rejected.
- **Headless-browser rendering for SPAs (B from Q3).** PSI gives this for free as a side-effect of its perf measurement; surface a warning if cheerio sees an empty page, defer real browser rendering until needed.
- **Color/icon metadata on categories.** Just `name` + `sort_order` for v1. Add `color TEXT` later if dashboard sections need visual differentiation beyond headers.
- **Audit retention / pruning.** Not for v1. With <100 audits per week and ~20KB per row, growth is negligible (~1MB/year). Add a "delete audits older than 90 days" cron only if it becomes a real concern.

---

## Definition of done (v1)

- [ ] Categories table seeded; `Uncategorized` system row exists.
- [ ] Existing `nemokamatv.lt` row has `category_id=1` after migration.
- [ ] `/domains` page renders categories panel + domain table; can create / rename / reorder / delete categories.
- [ ] Cannot delete `Uncategorized`. Deleting other categories reassigns domains to `Uncategorized`.
- [ ] Dashboard renders one section per non-empty category, ordered by `sort_order`.
- [ ] `/settings` retains OAuth, no longer holds domain CRUD.
- [ ] `/audit` page accepts a URL, returns an `id`, polls until completion, renders Lighthouse-style result.
- [ ] Re-auditing the same URL shows inline deltas next to scores and lab-CWV values.
- [ ] All existing tests pass (13/13 baseline). New tests pass. Total target: ~25 tests.
- [ ] `pnpm run build` succeeds.
- [ ] Manual smoke test: paste `https://nemokamatv.lt`, get a result, paste again, see deltas.

## Definition of done (v1.1)

- [ ] Textarea on `/audit` accepts a list of URLs.
- [ ] `POST /api/audit/batch` creates N rows; queue serializes execution.
- [ ] History list shows all batch members; each completes individually.
- [ ] Manual smoke test: paste 5 URLs, navigate away, come back, see all 5 in history.

---

## Estimated scope

| Phase | Files touched | New files | Lines | Realistic time |
|---|---|---|---|---|
| Domains v1 | ~6 modified | ~5 new | ~400 | 1 day |
| Audit v1 | ~3 modified | ~12 new | ~700 | 2 days |
| Audit v1.1 | ~3 modified | ~1 new | ~100 | 2 hours |

Total: ~3 working days for the entire scope of this plan.
