# AI Improvement Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an on-demand AI-generated SEO improvement guide to the Opportunities tab that streams context-aware, step-by-step actions (with forecasts) from a Claude/Codex CLI, saved to SQLite with per-step checkbox progress.

**Architecture:** Next.js API route assembles GSC + Lighthouse + live-page context, calls an `AIRunner` abstraction (local child_process or remote HTTP companion container), streams SSE to the browser, then parses and saves steps on completion. Guides use a supersede-not-delete pattern so previous progress is preserved on regeneration.

**Tech Stack:** better-sqlite3, Next.js App Router route handlers, Node.js child_process (local runner), SSE (`text/event-stream`), `@anthropic-ai/claude-code` CLI, Docker / docker-compose, Vitest

---

## File Map

**New files:**
- `docker/ai-runner/Dockerfile` — companion container image
- `docker/ai-runner/server.js` — HTTP→SSE wrapper for the CLI
- `src/lib/ai-runner/index.ts` — `AIRunner` interface + `LocalRunner` + `RemoteRunner` + `getRunner()`
- `src/lib/ai-runner/prompt.ts` — context assembly + user prompt builder
- `src/lib/ai-runner/parse.ts` — parse raw CLI markdown into `ParsedStep[]`
- `src/lib/db/queries/settings.ts` — `getSetting` / `setSetting`
- `src/lib/db/queries/guides.ts` — guide + guide_steps CRUD
- `src/lib/ai-runner/__tests__/parse.test.ts`
- `src/lib/ai-runner/__tests__/prompt.test.ts`
- `src/lib/db/__tests__/guides.test.ts`
- `src/app/api/guides/route.ts` — GET + POST (SSE)
- `src/app/api/guides/ping/route.ts` — GET ping
- `src/app/api/guides/[id]/route.ts` — DELETE
- `src/app/api/guides/[id]/steps/[stepId]/route.ts` — PATCH toggle
- `src/components/opportunities/guide-panel.tsx` — client island, all 3 states
- `src/components/settings/ai-runner-card.tsx` — settings card client component

**Modified files:**
- `src/lib/db/schema.ts` — add `settings`, `guides`, `guide_steps` tables
- `src/lib/db/index.ts` — add `runMigrations` guards for new tables
- `src/lib/google/search-console.ts` — add `["query","page"]` GSC dimension call
- `src/types/search-console.ts` — add `QueryPageRow` + `queryPages` to `GscReport`
- `src/lib/seo/opportunities.ts` — extend `computeOpportunities` to accept `queryPages`, add `page` to `OpportunityRow`
- `src/components/opportunities/opportunities-tab.tsx` — add `domainId` prop + wire `GuidePanel` into `Row`
- `src/app/domain/[id]/page.tsx` — pass `domainId` + `queryPages` to `OpportunitiesTab`
- `src/app/settings/page.tsx` — add `AiRunnerCard`
- `docker-compose.yml` — add `ai-runner` service + app env vars

---

## Task 1: Add settings, guides, guide_steps to DB schema

**Files:**
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Add the three new tables to SCHEMA_SQL**

  Open `src/lib/db/schema.ts` and append before the closing backtick:

  ```ts
  CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS guides (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    domain_id     INTEGER NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    url           TEXT NOT NULL,
    query         TEXT NOT NULL,
    model         TEXT NOT NULL,
    raw_markdown  TEXT NOT NULL,
    generated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    superseded_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_guides_lookup
    ON guides(domain_id, url, query, superseded_at);

  CREATE TABLE IF NOT EXISTS guide_steps (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    guide_id  INTEGER NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
    position  INTEGER NOT NULL,
    section   TEXT NOT NULL CHECK(section IN ('optimize', 'new_page')),
    text      TEXT NOT NULL,
    forecast  TEXT,
    done      INTEGER NOT NULL DEFAULT 0,
    done_at   INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_guide_steps_guide
    ON guide_steps(guide_id, position);
  ```

- [ ] **Step 2: Verify schema loads in existing test**

  Run: `pnpm vitest run src/lib/db/__tests__/schema.test.ts`
  Expected: PASS (schema test creates tables from SCHEMA_SQL — new tables should be created without error)

---

## Task 2: DB migrations for new tables

**Files:**
- Modify: `src/lib/db/index.ts`
- Modify: `src/lib/db/__tests__/migrations.test.ts`

- [ ] **Step 1: Write failing test for settings table migration idempotency**

  Add to `src/lib/db/__tests__/migrations.test.ts`:

  ```ts
  describe("runMigrations: settings / guides / guide_steps tables", () => {
    it("creates settings table on fresh DB and is idempotent", () => {
      const db = new Database(":memory:")
      db.exec(`
        CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE,
          sort_order INTEGER NOT NULL DEFAULT 0, is_system INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()));
        INSERT INTO categories (id, name, sort_order, is_system) VALUES (1,'Uncategorized',999,1);
        CREATE TABLE domains (id INTEGER PRIMARY KEY AUTOINCREMENT,
          hostname TEXT NOT NULL UNIQUE, ga4_property_id TEXT, gsc_site_url TEXT,
          category_id INTEGER NOT NULL DEFAULT 1 REFERENCES categories(id),
          created_at INTEGER NOT NULL DEFAULT (unixepoch()));
        CREATE TABLE sync_log (id INTEGER PRIMARY KEY AUTOINCREMENT,
          domain_id INTEGER REFERENCES domains(id) ON DELETE CASCADE,
          synced_at INTEGER NOT NULL DEFAULT (unixepoch()),
          status TEXT NOT NULL DEFAULT 'success', error_message TEXT);
        CREATE TABLE audits (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending', requested_at INTEGER NOT NULL DEFAULT (unixepoch()),
          completed_at INTEGER, result_json TEXT, error_message TEXT,
          strategy TEXT NOT NULL DEFAULT 'mobile');
      `)
      runMigrations(db)
      runMigrations(db) // idempotent

      const tables = db
        .query<{ name: string }, []>(
          "SELECT name FROM sqlite_master WHERE type='table'"
        )
        .all()
        .map((r) => r.name)

      expect(tables).toContain("settings")
      expect(tables).toContain("guides")
      expect(tables).toContain("guide_steps")
    })
  })
  ```

- [ ] **Step 2: Run test to see it fail**

  Run: `pnpm vitest run src/lib/db/__tests__/migrations.test.ts`
  Expected: FAIL — tables not yet created by `runMigrations`

- [ ] **Step 3: Add migration guard to runMigrations**

  In `src/lib/db/index.ts`, add at the end of `runMigrations()`:

  ```ts
  // settings, guides, guide_steps — added for AI improvement guide feature.
  // CREATE TABLE IF NOT EXISTS is safe to re-run; no ALTER needed.
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS guides (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      domain_id     INTEGER NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
      url           TEXT NOT NULL,
      query         TEXT NOT NULL,
      model         TEXT NOT NULL,
      raw_markdown  TEXT NOT NULL,
      generated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      superseded_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_guides_lookup
      ON guides(domain_id, url, query, superseded_at);

    CREATE TABLE IF NOT EXISTS guide_steps (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      guide_id  INTEGER NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
      position  INTEGER NOT NULL,
      section   TEXT NOT NULL CHECK(section IN ('optimize', 'new_page')),
      text      TEXT NOT NULL,
      forecast  TEXT,
      done      INTEGER NOT NULL DEFAULT 0,
      done_at   INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_guide_steps_guide
      ON guide_steps(guide_id, position);
  `)
  ```

- [ ] **Step 4: Run test to verify it passes**

  Run: `pnpm vitest run src/lib/db/__tests__/migrations.test.ts`
  Expected: PASS

---

## Task 3: DB queries — settings

**Files:**
- Create: `src/lib/db/queries/settings.ts`

- [ ] **Step 1: Create the file**

  ```ts
  import type { Database } from "../driver"

  export function getSetting(db: Database, key: string): string | null {
    return (
      db
        .query<{ value: string }, [string]>(
          "SELECT value FROM settings WHERE key = ?"
        )
        .get(key)?.value ?? null
    )
  }

  export function setSetting(db: Database, key: string, value: string): void {
    db.run(
      `INSERT INTO settings (key, value)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()`,
      [key, value]
    )
  }
  ```

- [ ] **Step 2: Run full test suite to confirm no regressions**

  Run: `pnpm vitest run`
  Expected: all existing tests PASS

---

## Task 4: DB queries — guides

**Files:**
- Create: `src/lib/db/queries/guides.ts`
- Create: `src/lib/db/__tests__/guides.test.ts`

- [ ] **Step 1: Write failing tests**

  Create `src/lib/db/__tests__/guides.test.ts`:

  ```ts
  import { describe, it, expect, beforeEach } from "vitest"
  import { Database } from "../driver"
  import { SCHEMA_SQL } from "../schema"
  import { runMigrations } from "../index"
  import {
    createGuide,
    createGuideSteps,
    getActiveGuide,
    supersedeActiveGuide,
    getPreviousGuide,
    toggleGuideStep,
    deleteGuide,
    type NewGuide,
    type NewStep,
  } from "../queries/guides"

  function makeDb(): Database {
    const db = new Database(":memory:")
    db.run("PRAGMA foreign_keys=ON")
    db.exec(SCHEMA_SQL)
    runMigrations(db)
    db.run("INSERT INTO domains (hostname) VALUES ('example.com')")
    return db
  }

  describe("createGuide + getActiveGuide", () => {
    it("creates a guide and retrieves it as active", () => {
      const db = makeDb()
      const g = createGuide(db, {
        domainId: 1, url: "https://example.com/page", query: "test query",
        model: "claude-sonnet-4-6", rawMarkdown: "## OPTIMIZE THIS PAGE\n1. Do X | Forecast: +5%",
      })
      expect(g.id).toBeGreaterThan(0)
      expect(g.superseded_at).toBeNull()

      const active = getActiveGuide(db, 1, "https://example.com/page", "test query")
      expect(active?.id).toBe(g.id)
    })
  })

  describe("supersedeActiveGuide", () => {
    it("marks the current guide superseded and a new one becomes active", () => {
      const db = makeDb()
      const g1 = createGuide(db, {
        domainId: 1, url: "https://example.com/page", query: "test query",
        model: "claude-sonnet-4-6", rawMarkdown: "old",
      })
      supersedeActiveGuide(db, 1, "https://example.com/page", "test query")
      const g2 = createGuide(db, {
        domainId: 1, url: "https://example.com/page", query: "test query",
        model: "claude-sonnet-4-6", rawMarkdown: "new",
      })

      const active = getActiveGuide(db, 1, "https://example.com/page", "test query")
      expect(active?.id).toBe(g2.id)

      const prev = getPreviousGuide(db, 1, "https://example.com/page", "test query")
      expect(prev?.id).toBe(g1.id)
      expect(prev?.superseded_at).not.toBeNull()
    })
  })

  describe("createGuideSteps + toggleGuideStep", () => {
    it("inserts steps and toggles done state", () => {
      const db = makeDb()
      const g = createGuide(db, {
        domainId: 1, url: "https://example.com/page", query: "q",
        model: "m", rawMarkdown: "",
      })
      createGuideSteps(db, g.id, [
        { position: 1, section: "optimize", text: "Step one", forecast: "LCP -1s" },
        { position: 2, section: "new_page", text: "Create article", forecast: "+200 clicks" },
      ])

      const guide = getActiveGuide(db, 1, "https://example.com/page", "q")
      expect(guide?.steps).toHaveLength(2)
      expect(guide?.steps[0].done).toBe(0)

      toggleGuideStep(db, guide!.steps[0].id, true)
      const updated = getActiveGuide(db, 1, "https://example.com/page", "q")
      expect(updated?.steps[0].done).toBe(1)
      expect(updated?.steps[0].done_at).not.toBeNull()

      toggleGuideStep(db, guide!.steps[0].id, false)
      const reverted = getActiveGuide(db, 1, "https://example.com/page", "q")
      expect(reverted?.steps[0].done).toBe(0)
      expect(reverted?.steps[0].done_at).toBeNull()
    })
  })

  describe("deleteGuide", () => {
    it("removes guide and cascades to steps", () => {
      const db = makeDb()
      const g = createGuide(db, {
        domainId: 1, url: "https://example.com/page", query: "q",
        model: "m", rawMarkdown: "",
      })
      createGuideSteps(db, g.id, [
        { position: 1, section: "optimize", text: "s", forecast: null },
      ])
      deleteGuide(db, g.id)
      expect(getActiveGuide(db, 1, "https://example.com/page", "q")).toBeNull()
      const steps = db
        .query<{ id: number }, [number]>("SELECT id FROM guide_steps WHERE guide_id = ?")
        .all(g.id)
      expect(steps).toHaveLength(0)
    })
  })
  ```

- [ ] **Step 2: Run test to verify it fails**

  Run: `pnpm vitest run src/lib/db/__tests__/guides.test.ts`
  Expected: FAIL — module not found

- [ ] **Step 3: Create guides queries**

  Create `src/lib/db/queries/guides.ts`:

  ```ts
  import type { Database } from "../driver"

  export interface GuideRow {
    id: number
    domain_id: number
    url: string
    query: string
    model: string
    raw_markdown: string
    generated_at: number
    superseded_at: number | null
  }

  export interface GuideStepRow {
    id: number
    guide_id: number
    position: number
    section: "optimize" | "new_page"
    text: string
    forecast: string | null
    done: number
    done_at: number | null
  }

  export interface GuideWithSteps extends GuideRow {
    steps: GuideStepRow[]
  }

  export interface NewGuide {
    domainId: number
    url: string
    query: string
    model: string
    rawMarkdown: string
  }

  export interface NewStep {
    position: number
    section: "optimize" | "new_page"
    text: string
    forecast: string | null
  }

  export function createGuide(db: Database, g: NewGuide): GuideRow {
    db.run(
      `INSERT INTO guides (domain_id, url, query, model, raw_markdown)
       VALUES (?, ?, ?, ?, ?)`,
      [g.domainId, g.url, g.query, g.model, g.rawMarkdown]
    )
    return db
      .query<GuideRow, []>("SELECT * FROM guides ORDER BY id DESC LIMIT 1")
      .get()!
  }

  export function createGuideSteps(db: Database, guideId: number, steps: NewStep[]): void {
    for (const s of steps) {
      db.run(
        `INSERT INTO guide_steps (guide_id, position, section, text, forecast)
         VALUES (?, ?, ?, ?, ?)`,
        [guideId, s.position, s.section, s.text, s.forecast ?? null]
      )
    }
  }

  export function getActiveGuide(
    db: Database,
    domainId: number,
    url: string,
    query: string
  ): GuideWithSteps | null {
    const guide = db
      .query<GuideRow, [number, string, string]>(
        `SELECT * FROM guides
         WHERE domain_id = ? AND url = ? AND query = ? AND superseded_at IS NULL
         ORDER BY generated_at DESC LIMIT 1`
      )
      .get(domainId, url, query)
    if (!guide) return null
    const steps = db
      .query<GuideStepRow, [number]>(
        "SELECT * FROM guide_steps WHERE guide_id = ? ORDER BY position"
      )
      .all(guide.id)
    return { ...guide, steps }
  }

  export function getPreviousGuide(
    db: Database,
    domainId: number,
    url: string,
    query: string
  ): GuideWithSteps | null {
    const guide = db
      .query<GuideRow, [number, string, string]>(
        `SELECT * FROM guides
         WHERE domain_id = ? AND url = ? AND query = ? AND superseded_at IS NOT NULL
         ORDER BY superseded_at DESC LIMIT 1`
      )
      .get(domainId, url, query)
    if (!guide) return null
    const steps = db
      .query<GuideStepRow, [number]>(
        "SELECT * FROM guide_steps WHERE guide_id = ? ORDER BY position"
      )
      .all(guide.id)
    return { ...guide, steps }
  }

  export function supersedeActiveGuide(
    db: Database,
    domainId: number,
    url: string,
    query: string
  ): void {
    db.run(
      `UPDATE guides SET superseded_at = unixepoch()
       WHERE domain_id = ? AND url = ? AND query = ? AND superseded_at IS NULL`,
      [domainId, url, query]
    )
  }

  export function toggleGuideStep(db: Database, stepId: number, done: boolean): void {
    if (done) {
      db.run(
        "UPDATE guide_steps SET done = 1, done_at = unixepoch() WHERE id = ?",
        [stepId]
      )
    } else {
      db.run(
        "UPDATE guide_steps SET done = 0, done_at = NULL WHERE id = ?",
        [stepId]
      )
    }
  }

  export function deleteGuide(db: Database, id: number): void {
    db.run("DELETE FROM guides WHERE id = ?", [id])
  }
  ```

- [ ] **Step 4: Run tests to verify they pass**

  Run: `pnpm vitest run src/lib/db/__tests__/guides.test.ts`
  Expected: PASS

---

## Task 5: Markdown parser

**Files:**
- Create: `src/lib/ai-runner/parse.ts`
- Create: `src/lib/ai-runner/__tests__/parse.test.ts`

- [ ] **Step 1: Write failing tests**

  Create `src/lib/ai-runner/__tests__/parse.test.ts`:

  ```ts
  import { describe, it, expect } from "vitest"
  import { parseGuideMarkdown } from "../parse"

  const SAMPLE = `
  ## OPTIMIZE THIS PAGE
  1. Write a meta description under 155 chars | Forecast: CTR +1–2% → ~20–40 clicks/mo
  2. Convert hero image to WebP | Forecast: LCP 3.8s → ~2.4s

  ## CREATE NEW PAGES
  1. "best seo tools" — Best SEO Tools in 2025: Ranked | Forecast: 2,100 impr/mo opportunity
  `

  describe("parseGuideMarkdown", () => {
    it("parses both sections", () => {
      const result = parseGuideMarkdown(SAMPLE)
      expect(result.optimize).toHaveLength(2)
      expect(result.new_page).toHaveLength(1)
    })

    it("extracts text and forecast for optimize steps", () => {
      const result = parseGuideMarkdown(SAMPLE)
      expect(result.optimize[0].text).toBe("Write a meta description under 155 chars")
      expect(result.optimize[0].forecast).toBe("CTR +1–2% → ~20–40 clicks/mo")
      expect(result.optimize[1].text).toBe("Convert hero image to WebP")
      expect(result.optimize[1].forecast).toBe("LCP 3.8s → ~2.4s")
    })

    it("extracts text and forecast for new_page steps", () => {
      const result = parseGuideMarkdown(SAMPLE)
      expect(result.new_page[0].text).toBe('"best seo tools" — Best SEO Tools in 2025: Ranked')
      expect(result.new_page[0].forecast).toBe("2,100 impr/mo opportunity")
    })

    it("returns empty arrays when sections are absent", () => {
      const result = parseGuideMarkdown("## OPTIMIZE THIS PAGE\n1. Just a step | Forecast: x")
      expect(result.new_page).toHaveLength(0)
    })

    it("handles steps with no Forecast separator gracefully", () => {
      const result = parseGuideMarkdown("## OPTIMIZE THIS PAGE\n1. Do something without forecast")
      expect(result.optimize[0].text).toBe("Do something without forecast")
      expect(result.optimize[0].forecast).toBeNull()
    })

    it("assigns positions starting at 1", () => {
      const result = parseGuideMarkdown(SAMPLE)
      expect(result.optimize[0].position).toBe(1)
      expect(result.optimize[1].position).toBe(2)
      expect(result.new_page[0].position).toBe(1)
    })
  })
  ```

- [ ] **Step 2: Run test to verify it fails**

  Run: `pnpm vitest run src/lib/ai-runner/__tests__/parse.test.ts`
  Expected: FAIL — module not found

- [ ] **Step 3: Implement the parser**

  Create `src/lib/ai-runner/parse.ts`:

  ```ts
  export interface ParsedStep {
    position: number
    section: "optimize" | "new_page"
    text: string
    forecast: string | null
  }

  export interface ParsedGuide {
    optimize: ParsedStep[]
    new_page: ParsedStep[]
  }

  const STEP_RE = /^\d+\.\s+(.+?)(?:\s+\|\s+Forecast:\s+(.+))?$/

  function parseSection(raw: string, section: "optimize" | "new_page"): ParsedStep[] {
    const steps: ParsedStep[] = []
    for (const line of raw.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const m = STEP_RE.exec(trimmed)
      if (!m) continue
      steps.push({
        position: steps.length + 1,
        section,
        text: m[1].trim(),
        forecast: m[2]?.trim() ?? null,
      })
    }
    return steps
  }

  export function parseGuideMarkdown(raw: string): ParsedGuide {
    const optimizeMatch = raw.match(/##\s*OPTIMIZE THIS PAGE\s*\n([\s\S]*?)(?=##\s*CREATE NEW PAGES|$)/)
    const newPageMatch = raw.match(/##\s*CREATE NEW PAGES\s*\n([\s\S]*)$/)

    return {
      optimize: optimizeMatch ? parseSection(optimizeMatch[1], "optimize") : [],
      new_page: newPageMatch ? parseSection(newPageMatch[1], "new_page") : [],
    }
  }
  ```

- [ ] **Step 4: Run tests to verify they pass**

  Run: `pnpm vitest run src/lib/ai-runner/__tests__/parse.test.ts`
  Expected: PASS

---

## Task 6: GSC query+page dimension sync

**Files:**
- Modify: `src/types/search-console.ts`
- Modify: `src/lib/google/search-console.ts`

- [ ] **Step 1: Add QueryPageRow type and extend GscReport**

  In `src/types/search-console.ts`, add after the `GscPageRow` interface:

  ```ts
  export interface QueryPageRow {
    query: string
    page: string
    clicks: number
    impressions: number
    ctr: number
    position: number
  }
  ```

  Add `queryPages: QueryPageRow[]` to the `GscReport` interface:

  ```ts
  export interface GscReport {
    overview: GscOverview
    topQueries: QueryRow[]
    topPages: GscPageRow[]
    daily: DailyGscRow[]
    positionBuckets: PositionBuckets
    queryPages: QueryPageRow[]   // ← add this line
  }
  ```

- [ ] **Step 2: Add 4th GSC call in fetchGSCReport**

  In `src/lib/google/search-console.ts`, extend the `Promise.all` to include a 4th call:

  ```ts
  const [queriesRes, pagesRes, dailyRes, queryPagesRes] = await Promise.all([
    // ... existing three calls unchanged ...
    webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ["query", "page"],
        rowLimit: 1000,
        aggregationType: "byPage",
      },
    }),
  ])

  // Add 4th recordApiCall:
  recordApiCall("gsc")
  ```

  Add the mapping after the existing `const daily` mapping:

  ```ts
  const queryPages: QueryPageRow[] = (queryPagesRes.data.rows ?? []).map((r) => ({
    query: r.keys?.[0] ?? "",
    page: r.keys?.[1] ?? "",
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }))
  ```

  Include `queryPages` in the returned object:

  ```ts
  return {
    overview: { totalClicks, totalImpressions, avgCtr, avgPosition },
    topQueries: queryRows,
    topPages,
    daily,
    positionBuckets,
    queryPages,   // ← add this
  }
  ```

- [ ] **Step 3: Run existing GSC tests to confirm no regressions**

  Run: `pnpm vitest run`
  Expected: PASS — the new field is additive and existing tests don't assert on the full return shape

---

## Task 7: Extend OpportunityRow with page URL

**Files:**
- Modify: `src/lib/seo/opportunities.ts`
- Modify: `src/lib/seo/__tests__/opportunities.test.ts`

- [ ] **Step 1: Add failing test for page field**

  In `src/lib/seo/__tests__/opportunities.test.ts`, add:

  ```ts
  import type { QueryPageRow } from "@/types/search-console"

  describe("computeOpportunities with queryPages", () => {
    it("attaches the best-matching page URL to each opportunity", () => {
      const queries = [
        { query: "fast page speed", clicks: 10, impressions: 500, ctr: 0.02, position: 8 },
        { query: "fast page speed", clicks: 2, impressions: 600, ctr: 0.003, position: 8 },
      ]
      const queryPages: QueryPageRow[] = [
        { query: "fast page speed", page: "https://example.com/speed", clicks: 8, impressions: 400, ctr: 0.02, position: 7 },
        { query: "fast page speed", page: "https://example.com/other", clicks: 2, impressions: 100, ctr: 0.02, position: 12 },
      ]
      // Re-build a minimal set that passes the opportunity filter
      const result = computeOpportunities(queries, queryPages)
      // The opportunity should have the highest-impressions page attached
      expect(result[0].page).toBe("https://example.com/speed")
    })

    it("leaves page undefined when queryPages is not provided", () => {
      const queries = [
        { query: "test", clicks: 5, impressions: 500, ctr: 0.01, position: 7 },
        { query: "test2", clicks: 3, impressions: 400, ctr: 0.0075, position: 9 },
      ]
      const result = computeOpportunities(queries)
      expect(result[0].page).toBeUndefined()
    })
  })
  ```

- [ ] **Step 2: Run test to verify it fails**

  Run: `pnpm vitest run src/lib/seo/__tests__/opportunities.test.ts`
  Expected: FAIL

- [ ] **Step 3: Update opportunities.ts**

  Replace the contents of `src/lib/seo/opportunities.ts`:

  ```ts
  import type { QueryRow } from "@/types/search-console"
  import type { QueryPageRow } from "@/types/search-console"

  export interface OpportunityRow extends QueryRow {
    opportunityScore: number
    page?: string
  }

  export function computeOpportunities(
    queries: QueryRow[],
    queryPages?: QueryPageRow[]
  ): OpportunityRow[] {
    const candidates = queries.filter((q) => q.position >= 4 && q.position <= 20)
    if (candidates.length === 0) return []

    const impressions = candidates.map((q) => q.impressions).sort((a, b) => a - b)
    const medianImpressions = impressions[Math.floor(impressions.length / 2)]
    const avgCtr = candidates.reduce((s, q) => s + q.ctr, 0) / candidates.length

    // Build a lookup: query → best page (highest impressions in queryPages)
    const bestPage = new Map<string, string>()
    if (queryPages) {
      for (const qp of queryPages) {
        const existing = queryPages
          .filter((r) => r.query === qp.query)
          .sort((a, b) => b.impressions - a.impressions)[0]
        if (existing) bestPage.set(qp.query, existing.page)
      }
    }

    return candidates
      .filter((q) => q.impressions >= medianImpressions && q.ctr <= avgCtr)
      .map((q) => ({
        ...q,
        opportunityScore: Math.round(
          (q.impressions / (q.position * Math.max(q.ctr, 0.001))) * 10
        ),
        page: bestPage.get(q.query),
      }))
      .sort((a, b) => b.opportunityScore - a.opportunityScore)
  }
  ```

- [ ] **Step 4: Run tests to verify they pass**

  Run: `pnpm vitest run src/lib/seo/__tests__/opportunities.test.ts`
  Expected: PASS

- [ ] **Step 5: Pass queryPages from domain page to computeOpportunities**

  In `src/app/domain/[id]/page.tsx`, find the line that calls `computeOpportunities`:

  ```ts
  // Before:
  const opportunities = computeOpportunities(gscData.topQueries)

  // After:
  const opportunities = computeOpportunities(
    gscData.topQueries,
    gscData.queryPages
  )
  ```

- [ ] **Step 6: Run full test suite**

  Run: `pnpm vitest run`
  Expected: PASS

---

## Task 8: Context assembler and prompt builder

**Files:**
- Create: `src/lib/ai-runner/prompt.ts`
- Create: `src/lib/ai-runner/__tests__/prompt.test.ts`

- [ ] **Step 1: Write failing tests**

  Create `src/lib/ai-runner/__tests__/prompt.test.ts`:

  ```ts
  import { describe, it, expect } from "vitest"
  import { buildUserPrompt, type GuideContext } from "../prompt"

  const BASE_CTX: GuideContext = {
    url: "https://example.com/page",
    query: "how to improve landing page speed",
    keywords: [
      { query: "how to improve landing page speed", position: 7.2, impressions: 3400, ctr: 0.012, selected: true },
      { query: "reduce page load time", position: 14.1, impressions: 890, ctr: 0.006, selected: false },
    ],
    lighthouse: {
      performance: 58, seo: 71,
      lcp: 3.8, cls: 0.04, tbt: 340,
      failingAudits: ["render-blocking-resources", "uses-optimized-images"],
      auditAge: "2d ago",
    },
    page: {
      title: "Improve Page Speed | MyBlog",
      h1: "Make Your Pages Faster",
      metaDescription: null,
    },
  }

  describe("buildUserPrompt", () => {
    it("includes URL and selected query", () => {
      const prompt = buildUserPrompt(BASE_CTX)
      expect(prompt).toContain("https://example.com/page")
      expect(prompt).toContain("how to improve landing page speed")
    })

    it("marks the selected keyword with [SELECTED]", () => {
      const prompt = buildUserPrompt(BASE_CTX)
      expect(prompt).toContain("[SELECTED]")
    })

    it("includes lighthouse metrics", () => {
      const prompt = buildUserPrompt(BASE_CTX)
      expect(prompt).toContain("Performance 58")
      expect(prompt).toContain("LCP 3.8")
    })

    it("shows MISSING for null meta description", () => {
      const prompt = buildUserPrompt(BASE_CTX)
      expect(prompt).toContain("meta description: MISSING")
    })

    it("shows UNAVAILABLE when lighthouse is null", () => {
      const ctx = { ...BASE_CTX, lighthouse: null }
      const prompt = buildUserPrompt(ctx)
      expect(prompt).toContain("UNAVAILABLE")
    })
  })
  ```

- [ ] **Step 2: Run test to verify it fails**

  Run: `pnpm vitest run src/lib/ai-runner/__tests__/prompt.test.ts`
  Expected: FAIL

- [ ] **Step 3: Implement prompt.ts**

  Create `src/lib/ai-runner/prompt.ts`:

  ```ts
  export interface KeywordContext {
    query: string
    position: number
    impressions: number
    ctr: number
    selected: boolean
  }

  export interface LighthouseContext {
    performance: number
    seo: number
    lcp: number
    cls: number
    tbt: number
    failingAudits: string[]
    auditAge: string
  }

  export interface PageContext {
    title: string | null
    h1: string | null
    metaDescription: string | null
  }

  export interface GuideContext {
    url: string
    query: string
    keywords: KeywordContext[]
    lighthouse: LighthouseContext | null
    page: PageContext | null
  }

  export const DEFAULT_SYSTEM_PROMPT = `You are an SEO expert. Given a page's Search Console data, Lighthouse audit results, and live page content, produce a prioritised improvement guide.

First, group all the provided keywords by search intent. Identify which keywords are best served by optimising the existing page versus creating a new dedicated page.

Output two sections using these exact headers:
## OPTIMIZE THIS PAGE
## CREATE NEW PAGES

Under OPTIMIZE THIS PAGE, list numbered steps. Each step must follow this format:
<action text> | Forecast: <specific metric impact>

Under CREATE NEW PAGES, list numbered items. Each must follow this format:
<keyword> — <suggested article title> | Forecast: <traffic opportunity>

Rules:
- 4–7 steps per section maximum (omit a section entirely if empty)
- Reference specific numbers from the data provided (position, LCP value, CTR gap, failing audit names)
- Order each section by highest estimated impact first
- No intro sentence, no conclusion paragraph, no extra markdown`

  export function buildUserPrompt(ctx: GuideContext): string {
    const kwList = ctx.keywords
      .map((k, i) => {
        const sel = k.selected ? " [SELECTED]" : ""
        return `${i + 1}. "${k.query}" — pos ${k.position.toFixed(1)}, ${k.impressions.toLocaleString()} impr, ${(k.ctr * 100).toFixed(2)}% CTR${sel}`
      })
      .join("\n")

    const lh = ctx.lighthouse
    const lhLine = lh
      ? `Lighthouse (${lh.auditAge}): Performance ${lh.performance}, SEO ${lh.seo}, LCP ${lh.lcp}s, CLS ${lh.cls}, TBT ${lh.tbt}ms\nFailing audits: ${lh.failingAudits.join(", ") || "none"}`
      : "Lighthouse: UNAVAILABLE"

    const pg = ctx.page
    const pgLine = pg
      ? `Page (live fetch): Title "${pg.title ?? "UNAVAILABLE"}", H1 "${pg.h1 ?? "UNAVAILABLE"}", meta description: ${pg.metaDescription ?? "MISSING"}`
      : "Page (live fetch): UNAVAILABLE"

    return [
      `URL: ${ctx.url}`,
      `Target query: "${ctx.query}"`,
      ``,
      `All keywords ranking for this URL (GSC, last 30d):`,
      kwList,
      ``,
      lhLine,
      ``,
      pgLine,
      ``,
      `Produce the improvement guide.`,
    ].join("\n")
  }
  ```

- [ ] **Step 4: Run tests to verify they pass**

  Run: `pnpm vitest run src/lib/ai-runner/__tests__/prompt.test.ts`
  Expected: PASS

---

## Task 9: AIRunner abstraction

**Files:**
- Create: `src/lib/ai-runner/index.ts`

- [ ] **Step 1: Create the file**

  ```ts
  import { spawn } from "child_process"

  export interface RunnerChunk {
    type: "chunk"
    text: string
  }

  export interface RunnerDone {
    type: "done"
  }

  export interface RunnerError {
    type: "error"
    message: string
  }

  export type RunnerEvent = RunnerChunk | RunnerDone | RunnerError

  export interface AIRunner {
    /** Returns an async generator that yields RunnerEvents. */
    stream(prompt: string, systemPrompt: string, model: string): AsyncGenerator<RunnerEvent>
    ping(): Promise<string>
  }

  class LocalRunner implements AIRunner {
    constructor(private readonly cli: string) {}

    async *stream(prompt: string, systemPrompt: string, model: string): AsyncGenerator<RunnerEvent> {
      const proc = spawn(this.cli, [
        "--print",
        "--model", model,
        "--append-system-prompt", systemPrompt,
      ])

      proc.stdin.end(prompt)

      let stderr = ""
      proc.stderr.on("data", (d: Buffer) => { stderr += d.toString() })

      for await (const chunk of proc.stdout) {
        yield { type: "chunk", text: (chunk as Buffer).toString() }
      }

      yield await new Promise<RunnerEvent>((resolve) => {
        proc.on("close", (code) => {
          if (code === 0) {
            resolve({ type: "done" })
          } else {
            resolve({ type: "error", message: stderr || `CLI exited with code ${code}` })
          }
        })
      })
    }

    async ping(): Promise<string> {
      return new Promise((resolve, reject) => {
        let out = ""
        const proc = spawn(this.cli, ["--version"])
        proc.stdout.on("data", (d: Buffer) => { out += d.toString() })
        proc.on("close", (code) => {
          if (code === 0) resolve(out.trim())
          else reject(new Error(`CLI version check failed (code ${code})`))
        })
      })
    }
  }

  class RemoteRunner implements AIRunner {
    constructor(private readonly baseUrl: string) {}

    async *stream(prompt: string, systemPrompt: string, model: string): AsyncGenerator<RunnerEvent> {
      const res = await fetch(`${this.baseUrl}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, systemPrompt, model }),
      })

      if (!res.ok || !res.body) {
        yield { type: "error", message: `Runner responded ${res.status}` }
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const payload = line.slice(6)
          if (payload === "[DONE]") {
            yield { type: "done" }
            return
          }
          try {
            const text = JSON.parse(payload) as string
            yield { type: "chunk", text }
          } catch {
            // skip malformed lines
          }
        }
      }
    }

    async ping(): Promise<string> {
      const res = await fetch(`${this.baseUrl}/ping`)
      if (!res.ok) throw new Error(`Ping failed: ${res.status}`)
      const body = await res.json() as { version: string }
      return body.version
    }
  }

  export function getRunner(): AIRunner {
    const mode = process.env.AI_RUNNER ?? "local"
    if (mode === "remote") {
      const url = process.env.AI_RUNNER_URL
      if (!url) throw new Error("AI_RUNNER_URL must be set when AI_RUNNER=remote")
      return new RemoteRunner(url)
    }
    const cli = process.env.AI_CLI ?? "claude"
    return new LocalRunner(cli)
  }
  ```

---

## Task 10: ai-runner Docker companion

**Files:**
- Create: `docker/ai-runner/Dockerfile`
- Create: `docker/ai-runner/server.js`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Create the Dockerfile**

  ```dockerfile
  FROM node:20-alpine
  RUN apk add --no-cache git curl jq bash
  RUN npm install -g @anthropic-ai/claude-code@latest
  WORKDIR /app
  COPY server.js .
  EXPOSE 3001
  CMD ["node", "server.js"]
  ```

- [ ] **Step 2: Create server.js**

  ```js
  const { createServer } = require("http")
  const { spawn } = require("child_process")

  const CLI = process.env.AI_CLI || "claude"
  const DEFAULT_MODEL = process.env.MODEL || "claude-sonnet-4-6"

  createServer((req, res) => {
    const url = new URL(req.url, "http://localhost")

    if (req.method === "GET" && url.pathname === "/ping") {
      const proc = spawn(CLI, ["--version"])
      let out = ""
      proc.stdout.on("data", (d) => { out += d.toString() })
      proc.on("close", () => {
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ version: out.trim() }))
      })
      return
    }

    if (req.method === "POST" && url.pathname === "/run") {
      let body = ""
      req.on("data", (d) => { body += d })
      req.on("end", () => {
        let parsed
        try { parsed = JSON.parse(body) } catch {
          res.writeHead(400)
          res.end("bad json")
          return
        }
        const { prompt, model = DEFAULT_MODEL, systemPrompt = "" } = parsed

        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        })

        const args = ["--print", "--model", model]
        if (systemPrompt) args.push("--append-system-prompt", systemPrompt)

        const proc = spawn(CLI, args)
        proc.stdin.end(prompt)

        proc.stdout.on("data", (chunk) => {
          res.write(`data: ${JSON.stringify(chunk.toString())}\n\n`)
        })

        proc.stderr.on("data", (chunk) => {
          console.error("[ai-runner stderr]", chunk.toString())
        })

        proc.on("close", (code) => {
          if (code !== 0) {
            res.write(`data: ${JSON.stringify({ __error: `CLI exited ${code}` })}\n\n`)
          }
          res.write("data: [DONE]\n\n")
          res.end()
        })
      })
      return
    }

    res.writeHead(404)
    res.end()
  }).listen(3001, () => {
    console.log("ai-runner listening on :3001")
  })
  ```

- [ ] **Step 3: Update docker-compose.yml**

  Read the current `docker-compose.yml`, then add the `ai-runner` service and env vars to the `app` service. Exact additions:

  Under `services:`, add:
  ```yaml
    ai-runner:
      build: ./docker/ai-runner
      environment:
        - MODEL=${AI_MODEL:-claude-sonnet-4-6}
        - AI_CLI=${AI_CLI:-claude}
        - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      restart: unless-stopped
  ```

  Under the `app` service `environment:` block, add:
  ```yaml
        - AI_RUNNER=${AI_RUNNER:-local}
        - AI_RUNNER_URL=${AI_RUNNER_URL:-http://ai-runner:3001}
        - AI_MODEL=${AI_MODEL:-claude-sonnet-4-6}
        - AI_CLI=${AI_CLI:-claude}
  ```

---

## Task 11: API routes

**Files:**
- Create: `src/app/api/guides/ping/route.ts`
- Create: `src/app/api/guides/route.ts`
- Create: `src/app/api/guides/[id]/route.ts`
- Create: `src/app/api/guides/[id]/steps/[stepId]/route.ts`

- [ ] **Step 1: Create ping route**

  ```ts
  // src/app/api/guides/ping/route.ts
  import { NextResponse } from "next/server"
  import { getRunner } from "@/lib/ai-runner"

  export async function GET() {
    try {
      const version = await getRunner().ping()
      return NextResponse.json({ version })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "ping failed" },
        { status: 503 }
      )
    }
  }
  ```

- [ ] **Step 2: Create GET /api/guides**

  ```ts
  // src/app/api/guides/route.ts  (GET handler)
  import { NextRequest, NextResponse } from "next/server"
  import { getDb } from "@/lib/db"
  import { getActiveGuide, getPreviousGuide } from "@/lib/db/queries/guides"

  export function GET(req: NextRequest) {
    const sp = req.nextUrl.searchParams
    const domainId = Number(sp.get("domainId"))
    const url = sp.get("url") ?? ""
    const query = sp.get("query") ?? ""

    if (!domainId || !url || !query) {
      return NextResponse.json({ error: "domainId, url, query required" }, { status: 400 })
    }

    const db = getDb()
    const active = getActiveGuide(db, domainId, url, query)
    const previous = getPreviousGuide(db, domainId, url, query)

    return NextResponse.json({ active, previous })
  }
  ```

- [ ] **Step 3: Create POST /api/guides (SSE streaming)**

  Add the `POST` export to `src/app/api/guides/route.ts`:

  ```ts
  import { getRunner } from "@/lib/ai-runner"
  import { buildUserPrompt } from "@/lib/ai-runner/prompt"
  import { parseGuideMarkdown } from "@/lib/ai-runner/parse"
  import { assembleGuideContext } from "@/lib/ai-runner/context"
  import {
    createGuide, createGuideSteps, supersedeActiveGuide,
  } from "@/lib/db/queries/guides"
  import { getSetting } from "@/lib/db/queries/settings"
  import { DEFAULT_SYSTEM_PROMPT } from "@/lib/ai-runner/prompt"

  export async function POST(req: NextRequest) {
    const { domainId, url, query } = await req.json() as {
      domainId: number; url: string; query: string
    }
    if (!domainId || !url || !query) {
      return NextResponse.json({ error: "domainId, url, query required" }, { status: 400 })
    }

    const db = getDb()
    const model = process.env.AI_MODEL ?? "claude-sonnet-4-6"
    const systemPrompt =
      getSetting(db, "ai_guide_system_prompt") ?? DEFAULT_SYSTEM_PROMPT

    const ctx = await assembleGuideContext(db, domainId, url, query)
    const userPrompt = buildUserPrompt(ctx)

    const runner = getRunner()
    let rawMarkdown = ""

    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder()
        function send(obj: unknown) {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`))
        }

        try {
          for await (const event of runner.stream(userPrompt, systemPrompt, model)) {
            if (event.type === "chunk") {
              rawMarkdown += event.text
              send({ type: "chunk", text: event.text })
            } else if (event.type === "error") {
              send({ type: "error", message: event.message })
              controller.close()
              return
            } else if (event.type === "done") {
              // Parse + save
              supersedeActiveGuide(db, domainId, url, query)
              const guide = createGuide(db, { domainId, url, query, model, rawMarkdown })
              const parsed = parseGuideMarkdown(rawMarkdown)
              const allSteps = [...parsed.optimize, ...parsed.new_page]
              createGuideSteps(db, guide.id, allSteps)

              const { getActiveGuide } = await import("@/lib/db/queries/guides")
              const saved = getActiveGuide(db, domainId, url, query)
              send({ type: "done", guide: saved })
              controller.close()
            }
          }
        } catch (err) {
          send({ type: "error", message: err instanceof Error ? err.message : "unknown error" })
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    })
  }
  ```

- [ ] **Step 4: Create DELETE /api/guides/[id]**

  ```ts
  // src/app/api/guides/[id]/route.ts
  import { NextRequest, NextResponse } from "next/server"
  import { getDb } from "@/lib/db"
  import { deleteGuide } from "@/lib/db/queries/guides"

  export function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) {
    const { id } = React.use(params) // Note: use await for async route handlers
    // Actually in Next.js 16 App Router route handlers, params is a Promise:
    return params.then(({ id }) => {
      const db = getDb()
      deleteGuide(db, Number(id))
      return NextResponse.json({ ok: true })
    })
  }
  ```

  Wait — in Next.js 16 App Router, route handler params come as a Promise. Use the async pattern:

  ```ts
  // src/app/api/guides/[id]/route.ts
  import { NextRequest, NextResponse } from "next/server"
  import { getDb } from "@/lib/db"
  import { deleteGuide } from "@/lib/db/queries/guides"

  export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) {
    const { id } = await params
    const db = getDb()
    deleteGuide(db, Number(id))
    return NextResponse.json({ ok: true })
  }
  ```

- [ ] **Step 5: Create PATCH /api/guides/[id]/steps/[stepId]**

  ```ts
  // src/app/api/guides/[id]/steps/[stepId]/route.ts
  import { NextRequest, NextResponse } from "next/server"
  import { getDb } from "@/lib/db"
  import { toggleGuideStep } from "@/lib/db/queries/guides"

  export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; stepId: string }> }
  ) {
    const { stepId } = await params
    const { done } = await req.json() as { done: boolean }
    const db = getDb()
    toggleGuideStep(db, Number(stepId), done)
    return NextResponse.json({ ok: true })
  }
  ```

---

## Task 12: Context assembler

**Files:**
- Create: `src/lib/ai-runner/context.ts`

This module reads DB + fetches the live page — no pure-unit test (I/O heavy); manual integration test is sufficient.

- [ ] **Step 1: Create context.ts**

  ```ts
  // src/lib/ai-runner/context.ts
  import type { Database } from "@/lib/db/driver"
  import type { GuideContext, KeywordContext, LighthouseContext, PageContext } from "./prompt"
  import type { AuditResult } from "@/types/audit"
  import type { GscReport } from "@/types/search-console"
  import { getGscCache } from "@/lib/db/queries/cache"

  async function fetchPageMeta(url: string): Promise<PageContext | null> {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "SEO-Analytics-Bot/1.0" },
      })
      clearTimeout(timeout)
      const html = await res.text()

      const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? null
      const h1 = html.match(/<h1[^>]*>([^<]*)<\/h1>/i)?.[1]?.trim() ?? null
      const metaDescription =
        html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1]?.trim() ??
        html.match(/<meta\s+content=["']([^"']*)["']\s+name=["']description["']/i)?.[1]?.trim() ??
        null

      return { title, h1, metaDescription }
    } catch {
      return null
    }
  }

  export async function assembleGuideContext(
    db: Database,
    domainId: number,
    url: string,
    query: string
  ): Promise<GuideContext> {
    // 1. GSC keywords for this URL
    const gscRaw = getGscCache(db, domainId, "1m")
    const gscReport = gscRaw as GscReport | null
    const urlKeywords: KeywordContext[] = (gscReport?.queryPages ?? [])
      .filter((qp) => qp.page === url)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 20)
      .map((qp) => ({
        query: qp.query,
        position: qp.position,
        impressions: qp.impressions,
        ctr: qp.ctr,
        selected: qp.query === query,
      }))

    // Ensure the selected query is included even if it's not in top 20
    if (!urlKeywords.some((k) => k.selected)) {
      urlKeywords.unshift({ query, position: 0, impressions: 0, ctr: 0, selected: true })
    }

    // 2. Latest Lighthouse audit
    let lighthouse: LighthouseContext | null = null
    try {
      const auditRow = db
        .query<{ result_json: string; requested_at: number }, [string]>(
          "SELECT result_json, requested_at FROM audits WHERE url = ? AND status = 'done' ORDER BY requested_at DESC LIMIT 1"
        )
        .get(url)
      if (auditRow?.result_json) {
        const result = JSON.parse(auditRow.result_json) as AuditResult
        const ageSeconds = Math.floor(Date.now() / 1000) - auditRow.requested_at
        const ageLabel =
          ageSeconds < 3600
            ? `${Math.round(ageSeconds / 60)}m ago`
            : ageSeconds < 86400
              ? `${Math.round(ageSeconds / 3600)}h ago`
              : `${Math.round(ageSeconds / 86400)}d ago`

        const failing = (result.audits ?? [])
          .filter((a) => a.score !== null && a.score < 0.9 && a.score > 0)
          .map((a) => a.id)
          .slice(0, 5)

        lighthouse = {
          performance: result.scores.performance,
          seo: result.scores.seo,
          lcp: result.vitals?.lcp ?? 0,
          cls: result.vitals?.cls ?? 0,
          tbt: result.vitals?.tbt ?? 0,
          failingAudits: failing,
          auditAge: ageLabel,
        }
      }
    } catch {
      // lighthouse stays null
    }

    // 3. Live page fetch
    const page = await fetchPageMeta(url)

    return { url, query, keywords: urlKeywords, lighthouse, page }
  }
  ```

- [ ] **Step 2: Check AuditResult type has the fields we use**

  Open `src/types/audit.ts` and verify `AuditResult` has `scores`, `vitals`, and `audits` fields. If `vitals` or `audits` are missing, add them:

  ```ts
  // In AuditResult, ensure these exist:
  vitals?: {
    lcp: number
    cls: number
    tbt: number
    fcp: number
    si: number
  }
  audits?: Array<{ id: string; score: number | null; title: string }>
  ```

- [ ] **Step 3: Run full test suite**

  Run: `pnpm vitest run`
  Expected: PASS

---

## Task 13: GuidePanel UI component

**Files:**
- Create: `src/components/opportunities/guide-panel.tsx`

- [ ] **Step 1: Create the component**

  ```tsx
  "use client"

  import { useCallback, useEffect, useRef, useState } from "react"
  import { formatDateTime } from "@/lib/format"
  import type { GuideWithSteps, GuideStepRow } from "@/lib/db/queries/guides"

  interface Props {
    domainId: number
    url: string
    query: string
  }

  type Section = "optimize" | "new_page"

  const FORECAST_COLOUR: Record<string, string> = {}

  function forecastColour(forecast: string): string {
    if (/lcp|tbt|cls|performance|perf|speed|fcp/i.test(forecast)) return "text-green-600"
    if (/ctr|click|traffic|impr/i.test(forecast)) return "text-amber-600"
    return "text-muted-foreground"
  }

  function DoneSteps({ steps }: { steps: GuideStepRow[] }) {
    return (
      <>{steps.filter(s => s.done).length} / {steps.length} steps done</>
    )
  }

  function StepList({
    steps,
    section,
    onToggle,
  }: {
    steps: GuideStepRow[]
    section: Section
    onToggle: (stepId: number, done: boolean) => void
  }) {
    const filtered = steps.filter((s) => s.section === section)
    if (filtered.length === 0) return null
    return (
      <div className="flex flex-col gap-1.5">
        {filtered.map((step) => (
          <label
            key={step.id}
            className={`flex items-start gap-2 px-2.5 py-2 bg-background border rounded-md cursor-pointer transition-opacity ${step.done ? "opacity-50" : ""}`}
          >
            <input
              type="checkbox"
              suppressHydrationWarning
              checked={step.done === 1}
              onChange={(e) => onToggle(step.id, e.target.checked)}
              className="mt-0.5 shrink-0"
            />
            <div>
              <span className={`text-sm ${step.done ? "line-through" : ""}`}>{step.text}</span>
              {step.forecast && (
                <div className={`text-xs mt-0.5 ${forecastColour(step.forecast)}`}>
                  Forecast: {step.forecast}
                </div>
              )}
            </div>
          </label>
        ))}
      </div>
    )
  }

  export function GuidePanel({ domainId, url, query }: Props) {
    const [active, setActive] = useState<GuideWithSteps | null | undefined>(undefined)
    const [previous, setPrevious] = useState<GuideWithSteps | null>(null)
    const [streaming, setStreaming] = useState(false)
    const [streamText, setStreamText] = useState("")
    const abortRef = useRef<AbortController | null>(null)

    const loadGuide = useCallback(async () => {
      const res = await fetch(
        `/api/guides?domainId=${domainId}&url=${encodeURIComponent(url)}&query=${encodeURIComponent(query)}`
      )
      if (!res.ok) return
      const body = await res.json() as { active: GuideWithSteps | null; previous: GuideWithSteps | null }
      setActive(body.active)
      setPrevious(body.previous)
    }, [domainId, url, query])

    useEffect(() => { loadGuide() }, [loadGuide])

    async function generate() {
      setStreaming(true)
      setStreamText("")
      abortRef.current = new AbortController()

      try {
        const res = await fetch("/api/guides", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domainId, url, query }),
          signal: abortRef.current.signal,
        })
        if (!res.body) return

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split("\n")
          buf = lines.pop() ?? ""
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue
            const payload = line.slice(6)
            try {
              const event = JSON.parse(payload) as { type: string; text?: string; guide?: GuideWithSteps; message?: string }
              if (event.type === "chunk" && event.text) {
                setStreamText((t) => t + event.text)
              } else if (event.type === "done" && event.guide) {
                setActive(event.guide)
                await loadGuide() // refresh previous too
              }
            } catch { /* skip */ }
          }
        }
      } finally {
        setStreaming(false)
      }
    }

    async function toggleStep(stepId: number, done: boolean) {
      await fetch(`/api/guides/${active!.id}/steps/${stepId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done }),
      })
      setActive((g) =>
        g
          ? {
              ...g,
              steps: g.steps.map((s) =>
                s.id === stepId ? { ...s, done: done ? 1 : 0, done_at: done ? Math.floor(Date.now() / 1000) : null } : s
              ),
            }
          : g
      )
    }

    // Not yet loaded
    if (active === undefined) return null

    // No guide yet — show generate button
    if (!active && !streaming) {
      return (
        <div className="mt-3">
          <button
            type="button"
            onClick={generate}
            className="text-xs px-3 py-1.5 border rounded-md hover:bg-muted transition-colors"
          >
            Generate guide
          </button>
        </div>
      )
    }

    // Streaming state
    if (streaming) {
      return (
        <div className="mt-3 border rounded-md p-3 space-y-2">
          <p className="text-xs text-muted-foreground">Generating… <span className="text-muted-foreground/60">~20s</span></p>
          <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">{streamText}<span className="animate-pulse">▌</span></pre>
        </div>
      )
    }

    // Saved guide
    const optimizeSteps = active!.steps.filter((s) => s.section === "optimize")
    const newPageSteps = active!.steps.filter((s) => s.section === "new_page")
    const doneCount = active!.steps.filter((s) => s.done).length
    const totalCount = active!.steps.length

    return (
      <div className="mt-3 border rounded-md p-3 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-medium">
            AI guide — {doneCount} / {totalCount} steps done
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {formatDateTime(active!.generated_at)} · {active!.model}
            </span>
            <button
              type="button"
              onClick={generate}
              className="text-xs px-2 py-0.5 border rounded hover:bg-muted transition-colors"
            >
              Regenerate
            </button>
          </div>
        </div>

        {/* Optimize section */}
        {optimizeSteps.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                Optimise this page
              </span>
            </div>
            <StepList steps={active!.steps} section="optimize" onToggle={toggleStep} />
          </div>
        )}

        {/* New pages section */}
        {newPageSteps.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                Consider new pages
              </span>
            </div>
            <StepList steps={active!.steps} section="new_page" onToggle={toggleStep} />
          </div>
        )}

        {/* Previous guide disclosure */}
        {previous && (
          <details className="border-t pt-2">
            <summary className="text-xs text-muted-foreground cursor-pointer">
              Previous guide: {previous.steps.filter((s) => s.done).length} / {previous.steps.length} steps done
              {previous.superseded_at && ` · ${formatDateTime(previous.superseded_at)}`}
            </summary>
            <div className="mt-2 space-y-1.5 opacity-60 pointer-events-none">
              <StepList steps={previous.steps} section="optimize" onToggle={() => {}} />
              <StepList steps={previous.steps} section="new_page" onToggle={() => {}} />
            </div>
          </details>
        )}
      </div>
    )
  }
  ```

---

## Task 14: Integrate GuidePanel into OpportunitiesTab

**Files:**
- Modify: `src/components/opportunities/opportunities-tab.tsx`
- Modify: `src/app/domain/[id]/page.tsx`

- [ ] **Step 1: Add domainId prop to OpportunitiesTab**

  In `src/components/opportunities/opportunities-tab.tsx`, change the component signature:

  ```ts
  // Before:
  export function OpportunitiesTab({ data }: { data: OpportunityRow[] }) {

  // After:
  export function OpportunitiesTab({ data, domainId }: { data: OpportunityRow[]; domainId: number }) {
  ```

  Pass `domainId` down to `Row`:

  ```tsx
  // In the tbody map:
  <Row
    key={i}
    row={row}
    domainId={domainId}
    isExpanded={expanded === i}
    onToggle={() => setExpanded((curr) => (curr === i ? null : i))}
  />
  ```

- [ ] **Step 2: Update Row to accept domainId and render GuidePanel**

  Add `domainId` to the `Row` props and import `GuidePanel`:

  ```tsx
  import { GuidePanel } from "./guide-panel"

  function Row({
    row,
    domainId,
    isExpanded,
    onToggle,
  }: {
    row: OpportunityRow
    domainId: number
    isExpanded: boolean
    onToggle: () => void
  }) {
    // ... existing logic unchanged ...

    return (
      <>
        {/* existing <tr> unchanged */}
        {isExpanded && (
          <tr className="bg-muted/30">
            <td colSpan={6} className="px-3 py-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* existing diagnosis + actions + potential clicks — unchanged */}
              </div>
              {/* Add GuidePanel below the existing content */}
              {row.page && (
                <GuidePanel
                  domainId={domainId}
                  url={row.page}
                  query={row.query}
                />
              )}
              {!row.page && (
                <p className="text-xs text-muted-foreground mt-2">
                  Sync this domain to enable AI guide (page URL not yet available).
                </p>
              )}
            </td>
          </tr>
        )}
      </>
    )
  }
  ```

- [ ] **Step 3: Pass domainId from domain page**

  In `src/app/domain/[id]/page.tsx`, find the `<OpportunitiesTab>` usage and add `domainId`:

  ```tsx
  // Before:
  <OpportunitiesTab data={opportunities} />

  // After:
  <OpportunitiesTab data={opportunities} domainId={domain.id} />
  ```

- [ ] **Step 4: Run full test suite**

  Run: `pnpm vitest run`
  Expected: PASS

---

## Task 15: Settings — AiRunnerCard + wire up settings page

**Files:**
- Create: `src/components/settings/ai-runner-card.tsx`
- Modify: `src/app/settings/page.tsx`
- Modify: `src/app/api/guides/route.ts` (add settings PATCH endpoint — or add separate settings API)

- [ ] **Step 1: Add settings API route**

  Create `src/app/api/settings/route.ts`:

  ```ts
  import { NextRequest, NextResponse } from "next/server"
  import { getDb } from "@/lib/db"
  import { getSetting, setSetting } from "@/lib/db/queries/settings"

  const ALLOWED_KEYS = [
    "ai_cli",
    "ai_runner",
    "ai_runner_url",
    "ai_model",
    "ai_guide_system_prompt",
  ] as const

  export function GET() {
    const db = getDb()
    const result: Record<string, string | null> = {}
    for (const key of ALLOWED_KEYS) {
      result[key] = getSetting(db, key)
    }
    return NextResponse.json(result)
  }

  export async function PATCH(req: NextRequest) {
    const body = await req.json() as Record<string, string>
    const db = getDb()
    for (const [key, value] of Object.entries(body)) {
      if ((ALLOWED_KEYS as readonly string[]).includes(key)) {
        setSetting(db, key, value)
      }
    }
    return NextResponse.json({ ok: true })
  }
  ```

- [ ] **Step 2: Create AiRunnerCard component**

  Create `src/components/settings/ai-runner-card.tsx`:

  ```tsx
  "use client"

  import { useEffect, useState } from "react"
  import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
  import { Button } from "@/components/ui/button"
  import { DEFAULT_SYSTEM_PROMPT } from "@/lib/ai-runner/prompt"

  interface Settings {
    ai_cli: string
    ai_runner: string
    ai_runner_url: string
    ai_model: string
    ai_guide_system_prompt: string
  }

  const DEFAULTS: Settings = {
    ai_cli: "claude",
    ai_runner: "local",
    ai_runner_url: "http://ai-runner:3001",
    ai_model: "claude-sonnet-4-6",
    ai_guide_system_prompt: DEFAULT_SYSTEM_PROMPT,
  }

  export function AiRunnerCard() {
    const [settings, setSettings] = useState<Settings>(DEFAULTS)
    const [pingStatus, setPingStatus] = useState<"idle" | "testing" | "ok" | "error">("idle")
    const [pingMessage, setPingMessage] = useState("")
    const [saving, setSaving] = useState(false)

    useEffect(() => {
      fetch("/api/settings")
        .then((r) => r.json())
        .then((body: Partial<Settings>) => {
          setSettings((prev) => ({
            ...prev,
            ...Object.fromEntries(
              Object.entries(body).filter(([, v]) => v !== null)
            ) as Partial<Settings>,
          }))
        })
        .catch(() => {})
    }, [])

    function set<K extends keyof Settings>(key: K, value: Settings[K]) {
      setSettings((prev) => ({ ...prev, [key]: value }))
    }

    async function testConnection() {
      setPingStatus("testing")
      setPingMessage("")
      try {
        const res = await fetch("/api/guides/ping")
        const body = await res.json() as { version?: string; error?: string }
        if (res.ok && body.version) {
          setPingStatus("ok")
          setPingMessage(body.version)
        } else {
          setPingStatus("error")
          setPingMessage(body.error ?? "Unknown error")
        }
      } catch (err) {
        setPingStatus("error")
        setPingMessage(err instanceof Error ? err.message : "Network error")
      }
    }

    async function save() {
      setSaving(true)
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      setSaving(false)
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">AI Runner</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">CLI Tool</label>
              <select
                value={settings.ai_cli}
                onChange={(e) => set("ai_cli", e.target.value)}
                className="w-full border rounded-md px-2 py-1.5 text-sm"
              >
                <option value="claude">claude</option>
                <option value="codex">codex</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Model</label>
              <input
                type="text"
                value={settings.ai_model}
                onChange={(e) => set("ai_model", e.target.value)}
                className="w-full border rounded-md px-2 py-1.5 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Runner Mode</label>
              <div className="inline-flex items-center border rounded-md overflow-hidden text-sm">
                {(["local", "remote"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => set("ai_runner", mode)}
                    className={`px-3 py-1.5 transition-colors ${settings.ai_runner === mode ? "bg-foreground text-background" : "hover:bg-muted"}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Remote URL</label>
              <input
                type="text"
                value={settings.ai_runner_url}
                onChange={(e) => set("ai_runner_url", e.target.value)}
                disabled={settings.ai_runner !== "remote"}
                placeholder="http://ai-runner:3001"
                className="w-full border rounded-md px-2 py-1.5 text-sm disabled:opacity-40"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button size="sm" variant="outline" onClick={testConnection} disabled={pingStatus === "testing"}>
              Test connection
            </Button>
            {pingStatus === "ok" && <span className="text-xs text-green-600">✓ {pingMessage}</span>}
            {pingStatus === "error" && <span className="text-xs text-red-600">✗ {pingMessage}</span>}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">System Prompt</label>
              <button
                type="button"
                onClick={() => set("ai_guide_system_prompt", DEFAULT_SYSTEM_PROMPT)}
                className="text-xs text-muted-foreground underline"
              >
                Reset to default
              </button>
            </div>
            <textarea
              value={settings.ai_guide_system_prompt}
              onChange={(e) => set("ai_guide_system_prompt", e.target.value)}
              rows={8}
              className="w-full border rounded-md px-3 py-2 text-xs font-mono resize-y"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">User Prompt Template (read-only)</label>
            <pre className="text-xs font-mono bg-muted rounded-md p-3 whitespace-pre-wrap text-muted-foreground leading-relaxed">
{`URL: {url}
Target query: "{query}"

All keywords ranking for this URL (GSC, last 30d):
{keywords_list}

Lighthouse ({audit_age}): Performance {perf}, SEO {seo}, LCP {lcp}s, CLS {cls}, TBT {tbt}ms
Failing audits: {failing_audit_titles}

Page (live fetch): Title "{title}", H1 "{h1}", meta description: {meta_desc_or_MISSING}

Produce the improvement guide.`}
            </pre>
          </div>

          <div className="flex justify-end">
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }
  ```

- [ ] **Step 3: Add AiRunnerCard to settings page**

  In `src/app/settings/page.tsx`, add the import and render the card:

  ```tsx
  import { AiRunnerCard } from "@/components/settings/ai-runner-card"

  // Inside the return, after the last existing Card:
  <AiRunnerCard />
  ```

- [ ] **Step 4: Run full test suite**

  Run: `pnpm vitest run`
  Expected: PASS

---

## Task 16: Final integration check

- [ ] **Step 1: Start dev server**

  Run: `pnpm dev`
  Expected: compiles without TypeScript errors

- [ ] **Step 2: Verify settings page**

  Open `http://localhost:3000/settings`. Confirm the AI Runner card renders with all fields. Click "Test connection" — expect either a version string (if `claude` CLI is installed locally) or a clear error message.

- [ ] **Step 3: Verify opportunities tab**

  Open any domain page, go to Opportunities tab. Expand a keyword row. If the domain has been synced (so `queryPages` is available), confirm "Generate guide" button appears. If not, confirm the fallback message "Sync this domain to enable AI guide" appears.

- [ ] **Step 4: End-to-end guide generation (requires claude CLI installed)**

  Click "Generate guide" on a keyword row. Confirm:
  1. Streaming text appears with blinking cursor
  2. On completion, checkboxes appear with two sections
  3. Checking a box toggles it immediately (optimistic) and persists on reload
  4. "Regenerate" supersedes the old guide and shows "Previous guide: N / M done"

- [ ] **Step 5: Run full test suite one final time**

  Run: `pnpm vitest run`
  Expected: all PASS
