import { describe, it, expect, beforeEach } from "vitest"
import { Database } from "../driver"
import { SCHEMA_SQL } from "../schema"
import {
  createAudit,
  getAudit,
  listAudits,
  listAuditsForUrl,
  listAuditsFiltered,
  listAuditGroupsFiltered,
  listAuditDomainGroupsFiltered,
  listAuditsForHostname,
  setAuditResult,
  setAuditError,
  getPriorCompletedAudit,
  deleteAudit,
} from "../queries/audits"
import type { AuditResult } from "@/types/audit"

function emptyResult(): AuditResult {
  return {
    fetchedUrl: "https://x/",
    finalUrl: "https://x/",
    scores: { performance: 80, accessibility: 90, bestPractices: 70, seo: 100 },
    labCwv: { lcp: null, cls: null, tbt: null, fcp: null, si: null },
    fieldCwv: { lcp: null, cls: null, inp: null },
    audits: [],
  }
}

describe("audits queries", () => {
  let db: Database

  beforeEach(() => {
    db = new Database(":memory:")
    db.run("PRAGMA foreign_keys=ON")
    db.exec(SCHEMA_SQL)
  })

  it("creates an audit with status 'pending' and timestamp", () => {
    const a = createAudit(db, "https://example.com/")
    expect(a.id).toBeGreaterThan(0)
    expect(a.url).toBe("https://example.com/")
    expect(a.status).toBe("pending")
    expect(a.requested_at).toBeGreaterThan(0)
    expect(a.result_json).toBeNull()
  })

  it("setAuditResult marks done and persists JSON", () => {
    const a = createAudit(db, "https://x/")
    setAuditResult(db, a.id, emptyResult())
    const fresh = getAudit(db, a.id)!
    expect(fresh.status).toBe("done")
    expect(fresh.completed_at).toBeGreaterThan(0)
    const parsed = JSON.parse(fresh.result_json!) as AuditResult
    expect(parsed.scores.seo).toBe(100)
  })

  it("setAuditError marks error and stores message", () => {
    const a = createAudit(db, "https://x/")
    setAuditError(db, a.id, "boom")
    const fresh = getAudit(db, a.id)!
    expect(fresh.status).toBe("error")
    expect(fresh.error_message).toBe("boom")
  })

  it("listAudits orders by requested_at DESC", async () => {
    const a = createAudit(db, "https://a/")
    await new Promise((r) => setTimeout(r, 1100))
    const b = createAudit(db, "https://b/")
    const list = listAudits(db, 50)
    expect(list[0].id).toBe(b.id)
    expect(list[1].id).toBe(a.id)
  })

  it("getPriorCompletedAudit returns the previous done audit for the same URL", () => {
    const a1 = createAudit(db, "https://x/")
    setAuditResult(db, a1.id, emptyResult())
    const a2 = createAudit(db, "https://x/")
    setAuditResult(db, a2.id, emptyResult())
    const a3 = createAudit(db, "https://x/")
    // a3 is still pending; prior of a3 should be a2
    const prior = getPriorCompletedAudit(db, "https://x/", a3.id)
    expect(prior?.id).toBe(a2.id)
  })

  it("getPriorCompletedAudit ignores other URLs", () => {
    const a1 = createAudit(db, "https://x/")
    setAuditResult(db, a1.id, emptyResult())
    const b1 = createAudit(db, "https://y/")
    setAuditResult(db, b1.id, emptyResult())
    const b2 = createAudit(db, "https://y/")
    expect(getPriorCompletedAudit(db, "https://y/", b2.id)?.id).toBe(b1.id)
  })

  it("deleteAudit removes the row", () => {
    const a = createAudit(db, "https://x/")
    deleteAudit(db, a.id)
    expect(getAudit(db, a.id)).toBeNull()
  })

  it("createAudit defaults strategy to 'mobile' and accepts 'desktop'", () => {
    const m = createAudit(db, "https://x/")
    const d = createAudit(db, "https://y/", "desktop")
    expect(m.strategy).toBe("mobile")
    expect(d.strategy).toBe("desktop")
  })

  it("listAuditsForUrl returns every row for that URL, newest first", async () => {
    const a1 = createAudit(db, "https://x/")
    await new Promise((r) => setTimeout(r, 1100))
    const a2 = createAudit(db, "https://x/", "desktop")
    // An unrelated URL — must NOT appear in the result.
    createAudit(db, "https://y/")
    const list = listAuditsForUrl(db, "https://x/")
    expect(list.map((r) => r.id)).toEqual([a2.id, a1.id])
  })

  it("listAuditsFiltered paginates and surfaces total", () => {
    for (let i = 0; i < 5; i++) {
      const a = createAudit(db, `https://x/${i}`)
      setAuditResult(db, a.id, emptyResult())
    }
    const page = listAuditsFiltered(db, { limit: 2, offset: 0 })
    expect(page.total).toBe(5)
    expect(page.rows.length).toBe(2)
    const next = listAuditsFiltered(db, { limit: 2, offset: 2 })
    expect(next.rows.length).toBe(2)
  })

  it("listAuditsFiltered filters by status, since, and search substring", () => {
    const a = createAudit(db, "https://blog.example.com/post1")
    setAuditResult(db, a.id, emptyResult())
    const b = createAudit(db, "https://example.com/")
    setAuditError(db, b.id, "boom")
    // Search by URL substring
    const byUrl = listAuditsFiltered(db, {
      search: "blog",
      limit: 10,
      offset: 0,
    })
    expect(byUrl.total).toBe(1)
    expect(byUrl.rows[0].url).toContain("blog")
    // Filter by status
    const errs = listAuditsFiltered(db, {
      status: "error",
      limit: 10,
      offset: 0,
    })
    expect(errs.total).toBe(1)
    expect(errs.rows[0].id).toBe(b.id)
    // Filter by since (way in the future → empty)
    const empty = listAuditsFiltered(db, {
      sinceUnix: Math.floor(Date.now() / 1000) + 86400,
      limit: 10,
      offset: 0,
    })
    expect(empty.total).toBe(0)
  })

  it("listAuditGroupsFiltered folds by URL and counts audits per URL", () => {
    const a1 = createAudit(db, "https://x/page")
    setAuditResult(db, a1.id, emptyResult())
    const a2 = createAudit(db, "https://x/page")
    setAuditResult(db, a2.id, emptyResult())
    const b1 = createAudit(db, "https://y/")
    setAuditResult(db, b1.id, emptyResult())
    const page = listAuditGroupsFiltered(db, { limit: 10, offset: 0 })
    expect(page.total).toBe(2)
    const xRow = page.rows.find((r) => r.url === "https://x/page")!
    expect(xRow.count).toBe(2)
    const yRow = page.rows.find((r) => r.url === "https://y/")!
    expect(yRow.count).toBe(1)
  })

  it("listAuditDomainGroupsFiltered folds by hostname and tallies audits + URLs", () => {
    // Two URLs on example.com (one with multiple audits), one URL on other.com.
    const a1 = createAudit(db, "https://example.com/a")
    setAuditResult(db, a1.id, emptyResult())
    const a2 = createAudit(db, "https://example.com/a")
    setAuditResult(db, a2.id, emptyResult())
    const a3 = createAudit(db, "https://example.com/b")
    setAuditResult(db, a3.id, emptyResult())
    const b1 = createAudit(db, "https://other.com/")
    setAuditResult(db, b1.id, emptyResult())

    const page = listAuditDomainGroupsFiltered(db, { limit: 10, offset: 0 })
    expect(page.total).toBe(2)
    const example = page.rows.find((r) => r.hostname === "example.com")!
    expect(example.audits).toBe(3)
    expect(example.urls).toBe(2)
    const other = page.rows.find((r) => r.hostname === "other.com")!
    expect(other.audits).toBe(1)
    expect(other.urls).toBe(1)
  })

  it("listAuditsForHostname matches hostnames but not lookalike strings", () => {
    const a = createAudit(db, "https://example.com/blog")
    setAuditResult(db, a.id, emptyResult())
    const b = createAudit(db, "http://example.com")
    setAuditResult(db, b.id, emptyResult())
    // The lookalike URL should NOT match `example.com` — different hostname.
    const c = createAudit(db, "https://example.com.evil.test/")
    setAuditResult(db, c.id, emptyResult())
    const res = listAuditsForHostname(db, "example.com", 10, 0)
    const ids = res.rows.map((r) => r.id).sort()
    expect(ids).toEqual([a.id, b.id].sort())
    expect(res.total).toBe(2)
  })
})
