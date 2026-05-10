import { describe, it, expect, beforeEach } from "vitest"
import { Database } from "../driver"
import { SCHEMA_SQL } from "../schema"
import { getApiUsageStats, recordApiCall } from "../queries/api-usage"

function newDb(): Database {
  const db = new Database(":memory:")
  db.run("PRAGMA foreign_keys=ON")
  db.exec(SCHEMA_SQL)
  return db
}

describe("api usage tracking", () => {
  let db: Database

  beforeEach(() => {
    db = newDb()
  })

  it("returns zeros for every API on a fresh DB", () => {
    const stats = getApiUsageStats(db)
    expect(stats.find((r) => r.api === "ga4")?.today).toBe(0)
    expect(stats.find((r) => r.api === "psi")?.month).toBe(0)
    expect(stats).toHaveLength(4) // ga4, gsc, crux, psi
  })

  it("increments today's count for the given API", () => {
    recordApiCall("ga4", db)
    recordApiCall("ga4", db)
    recordApiCall("gsc", db)
    const stats = getApiUsageStats(db)
    expect(stats.find((r) => r.api === "ga4")?.today).toBe(2)
    expect(stats.find((r) => r.api === "gsc")?.today).toBe(1)
    expect(stats.find((r) => r.api === "crux")?.today).toBe(0)
  })

  it("rolls into this-month total via UTC day prefix grouping", () => {
    const today = new Date().toISOString().slice(0, 10)
    const monthPrefix = today.slice(0, 7)
    // Seed two earlier days in the same month and one in another month.
    db.run("INSERT INTO api_call_counts (api, day, count) VALUES (?, ?, ?)", [
      "ga4",
      `${monthPrefix}-01`,
      5,
    ])
    db.run("INSERT INTO api_call_counts (api, day, count) VALUES (?, ?, ?)", [
      "ga4",
      `${monthPrefix}-15`,
      8,
    ])
    db.run("INSERT INTO api_call_counts (api, day, count) VALUES (?, ?, ?)", [
      "ga4",
      "1999-12-31",
      999,
    ])
    recordApiCall("ga4", db) // today

    const stats = getApiUsageStats(db)
    const ga4 = stats.find((r) => r.api === "ga4")!
    expect(ga4.today).toBe(1)
    expect(ga4.month).toBe(5 + 8 + 1) // last-month seed excluded
  })

  it("includes label, free limit, and href for each API", () => {
    const stats = getApiUsageStats(db)
    for (const row of stats) {
      expect(row.label.length).toBeGreaterThan(0)
      expect(row.freeLimit.length).toBeGreaterThan(0)
      expect(row.href).toMatch(/^https?:\/\//)
    }
  })
})
