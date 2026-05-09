import { describe, it, expect, beforeEach } from "vitest"
import { Database } from "../driver"
import { SCHEMA_SQL } from "../schema"
import {
  createAudit,
  getAudit,
  listAudits,
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
})
