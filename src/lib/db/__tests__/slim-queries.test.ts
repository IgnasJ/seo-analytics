import { describe, it, expect, beforeEach } from "vitest"
import { Database } from "../driver"
import { SCHEMA_SQL } from "../schema"
import {
  createAudit,
  getAudit,
  listAudits,
  listAuditsFiltered,
  listAuditsForHostname,
  listAuditGroupsFiltered,
  listAuditDomainGroupsFiltered,
  listAuditsForSummary,
  setAuditResult,
} from "../queries/audits"
import {
  getAnalyticsSummary,
  getGscSummary,
  getLatestSync,
  recordSync,
  setAnalyticsCache,
  setGscCache,
} from "../queries/cache"
import { summariseAudits } from "@/lib/audit/aggregates"
import type { AuditEntry, AuditResult } from "@/types/audit"

function entry(id: string, severity: AuditEntry["severity"]): AuditEntry {
  return {
    id,
    title: `Title of ${id}`,
    description: "x".repeat(500),
    score: severity === "fail" ? 0 : 1,
    category: "performance",
    severity,
    numericSavings: null,
  }
}

function fullResult(perf: number, entries: AuditEntry[]): AuditResult {
  return {
    fetchedUrl: "https://x/",
    finalUrl: "https://x/final",
    scores: { performance: perf, accessibility: 90, bestPractices: 70, seo: 100 },
    labCwv: { lcp: 1200, cls: 0.01, tbt: 30, fcp: 800, si: 1500 },
    fieldCwv: { lcp: null, cls: null, inp: null },
    audits: entries,
    strategy: "mobile",
    screenshot: "data:image/png;base64," + "A".repeat(20_000),
  }
}

function newDb(): Database {
  const db = new Database(":memory:")
  db.run("PRAGMA foreign_keys=ON")
  db.exec(SCHEMA_SQL)
  return db
}

describe("slim audit list rows", () => {
  let db: Database
  beforeEach(() => {
    db = newDb()
  })

  it("list queries return scores only, never the full result", () => {
    const a = createAudit(db, "https://example.com/page")
    setAuditResult(db, a.id, fullResult(42, [entry("lcp", "fail"), entry("ok", "pass")]))

    const full = getAudit(db, a.id)!
    expect(full.result_json!.length).toBeGreaterThan(20_000)

    const lists = [
      listAudits(db, 50),
      listAuditsFiltered(db, { limit: 10, offset: 0 }).rows,
      listAuditsForHostname(db, "example.com", 10, 0).rows,
      listAuditGroupsFiltered(db, { limit: 10, offset: 0 }).rows.map((g) => g.latest),
      listAuditDomainGroupsFiltered(db, { limit: 10, offset: 0 }).rows.map((g) => g.latest),
    ]
    for (const rows of lists) {
      expect(rows).toHaveLength(1)
      const row = rows[0]
      expect(row.id).toBe(a.id)
      expect(row.status).toBe("done")
      expect(row.result_json!.length).toBeLessThan(400)
      const parsed = JSON.parse(row.result_json!) as AuditResult
      expect(parsed.scores).toEqual({
        performance: 42,
        accessibility: 90,
        bestPractices: 70,
        seo: 100,
      })
      expect(parsed.finalUrl).toBe("https://x/final")
      expect(parsed.audits).toBeUndefined()
      expect(parsed.screenshot).toBeUndefined()
    }
  })

  it("keeps result_json null for unfinished audits and survives malformed JSON", () => {
    const pending = createAudit(db, "https://example.com/a")
    const broken = createAudit(db, "https://example.com/b")
    db.run("UPDATE audits SET status = 'done', result_json = ? WHERE id = ?", [
      "{not json",
      broken.id,
    ])

    const rows = listAuditsFiltered(db, { limit: 10, offset: 0 }).rows
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.id === pending.id)!.result_json).toBeNull()
    expect(rows.find((r) => r.id === broken.id)!.result_json).toBeNull()
  })

  it("createAudit returns the row it inserted", () => {
    const a = createAudit(db, "https://example.com/1")
    const b = createAudit(db, "https://example.com/2", "desktop")
    expect(a.url).toBe("https://example.com/1")
    expect(b.url).toBe("https://example.com/2")
    expect(b.strategy).toBe("desktop")
    expect(b.id).toBeGreaterThan(a.id)
  })
})

describe("listAuditsForSummary", () => {
  it("feeds summariseAudits the same answer as full rows would", () => {
    const db = newDb()
    const a = createAudit(db, "https://example.com/a")
    setAuditResult(db, a.id, fullResult(30, [entry("lcp", "fail"), entry("cls", "fail")]))
    const b = createAudit(db, "https://example.com/b")
    setAuditResult(db, b.id, fullResult(95, [entry("lcp", "fail"), entry("ok", "pass")]))
    createAudit(db, "https://example.com/pending")

    const slim = listAuditsForSummary(db, 0, 500)
    expect(slim).toHaveLength(2)
    for (const row of slim) expect(row.result_json!.length).toBeLessThan(1000)

    const fullRows = [getAudit(db, a.id)!, getAudit(db, b.id)!]
    expect(summariseAudits(slim)).toEqual(summariseAudits(fullRows))

    const summary = summariseAudits(slim)
    expect(summary.kpis.total).toBe(2)
    expect(summary.kpis.failingAudits).toBe(1)
    expect(summary.commonFailures[0]).toMatchObject({ id: "lcp", urlsAffected: 2 })
  })

  it("handles an audit with no failing entries", () => {
    const db = newDb()
    const a = createAudit(db, "https://example.com/a")
    setAuditResult(db, a.id, fullResult(99, [entry("ok", "pass")]))
    const summary = summariseAudits(listAuditsForSummary(db, 0, 500))
    expect(summary.kpis.total).toBe(1)
    expect(summary.commonFailures).toEqual([])
  })

  it("respects the since bound", () => {
    const db = newDb()
    const a = createAudit(db, "https://example.com/a")
    setAuditResult(db, a.id, fullResult(50, []))
    const future = Math.floor(Date.now() / 1000) + 3600
    expect(listAuditsForSummary(db, future, 500)).toEqual([])
  })
})

describe("cache summaries", () => {
  let db: Database
  let domainId: number
  beforeEach(() => {
    db = newDb()
    db.run("INSERT INTO domains (hostname) VALUES (?)", ["example.com"])
    domainId = db
      .query<{ id: number }, []>("SELECT id FROM domains LIMIT 1")
      .get()!.id
  })

  it("getGscSummary returns overview + daily without the big tables", () => {
    setGscCache(db, domainId, "1m", {
      overview: { totalClicks: 5, totalImpressions: 100, avgCtr: 0.05, avgPosition: 7 },
      daily: [{ date: "2026-01-01", clicks: 5, impressions: 100 }],
      topQueries: Array.from({ length: 500 }, (_, i) => ({ query: `q${i}` })),
      queryPages: Array.from({ length: 1000 }, (_, i) => ({ query: `q${i}`, page: "/" })),
    })
    expect(getGscSummary(db, domainId, "1m")).toEqual({
      overview: { totalClicks: 5, totalImpressions: 100, avgCtr: 0.05, avgPosition: 7 },
      daily: [{ date: "2026-01-01", clicks: 5, impressions: 100 }],
    })
    expect(getGscSummary(db, domainId, "7d")).toBeNull()
  })

  it("getAnalyticsSummary drops only topPages", () => {
    setAnalyticsCache(db, domainId, "1m", {
      overview: { sessions: 10 },
      daily: [{ date: "20260101", sessions: 10, users: 8 }],
      channels: [{ channel: "Organic", sessions: 10 }],
      topPages: [{ pagePath: "/", sessions: 10, pageviews: 12 }],
    })
    expect(getAnalyticsSummary(db, domainId, "1m")).toEqual({
      overview: { sessions: 10 },
      daily: [{ date: "20260101", sessions: 10, users: 8 }],
      channels: [{ channel: "Organic", sessions: 10 }],
    })
    expect(getAnalyticsSummary(db, domainId, "1y")).toBeNull()
  })

  it("getLatestSync returns the newest attempt, breaking same-second ties by id", () => {
    expect(getLatestSync(db, domainId)).toBeNull()
    recordSync(db, domainId, "success")
    recordSync(db, domainId, "error", "boom")
    const latest = getLatestSync(db, domainId)!
    expect(latest.status).toBe("error")
    expect(typeof latest.syncedAt).toBe("number")
  })
})

describe("prepared statement cache", () => {
  it("keeps returning fresh results and survives a schema change", () => {
    const db = newDb()
    const count = () =>
      db.query<{ n: number }, []>("SELECT COUNT(*) AS n FROM domains").get()!.n
    expect(count()).toBe(0)
    db.run("INSERT INTO domains (hostname) VALUES (?)", ["a.com"])
    db.run("INSERT INTO domains (hostname) VALUES (?)", ["b.com"])
    expect(count()).toBe(2)

    const all = () => db.query<Record<string, unknown>, []>("SELECT * FROM domains").all()
    expect(Object.keys(all()[0])).not.toContain("note")
    db.exec("ALTER TABLE domains ADD COLUMN note TEXT")
    expect(Object.keys(all()[0])).toContain("note")
  })
})
