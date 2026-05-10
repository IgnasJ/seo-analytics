import { describe, it, expect } from "vitest"
import { cardHealth, healthCounts, type CardSignals } from "../health"

const ONE_DAY = 24 * 60 * 60
const NOW = () => Math.floor(Date.now() / 1000)

function signals(over: Partial<CardSignals> = {}): CardSignals {
  return {
    ga4Linked: true,
    gscLinked: true,
    lastSyncedAt: NOW() - 1000,
    lastSyncStatus: "success",
    issueCount: 0,
    ...over,
  }
}

describe("cardHealth", () => {
  it("returns green for an all-healthy card", () => {
    const r = cardHealth(signals())
    expect(r.severity).toBe("green")
    expect(r.reasons).toContain("All systems healthy")
  })

  it("amber when GA4 is unlinked", () => {
    const r = cardHealth(signals({ ga4Linked: false }))
    expect(r.severity).toBe("amber")
    expect(r.reasons.some((r) => /Analytics/i.test(r))).toBe(true)
  })

  it("amber when GSC is unlinked", () => {
    const r = cardHealth(signals({ gscLinked: false }))
    expect(r.severity).toBe("amber")
    expect(r.reasons.some((r) => /Search Console/i.test(r))).toBe(true)
  })

  it("amber when never synced", () => {
    const r = cardHealth(signals({ lastSyncedAt: null }))
    expect(r.severity).toBe("amber")
    expect(r.reasons).toContain("Never synced")
  })

  it("amber when sync is 24-48h old", () => {
    const r = cardHealth(signals({ lastSyncedAt: NOW() - 30 * 3600 }))
    expect(r.severity).toBe("amber")
    expect(r.reasons.some((r) => /hours/.test(r))).toBe(true)
  })

  it("red when sync is older than 48h", () => {
    const r = cardHealth(signals({ lastSyncedAt: NOW() - 4 * ONE_DAY }))
    expect(r.severity).toBe("red")
    expect(r.reasons.some((r) => /days/.test(r))).toBe(true)
  })

  it("red when most recent sync failed", () => {
    const r = cardHealth(signals({ lastSyncStatus: "error" }))
    expect(r.severity).toBe("red")
    expect(r.reasons.some((r) => /failed/i.test(r))).toBe(true)
  })

  it("red when issueCount is non-zero", () => {
    const r = cardHealth(signals({ issueCount: 3 }))
    expect(r.severity).toBe("red")
    expect(r.reasons.some((r) => /3 active/.test(r))).toBe(true)
  })

  it("red dominates amber when both signals fire", () => {
    const r = cardHealth(
      signals({ ga4Linked: false, lastSyncStatus: "error" })
    )
    expect(r.severity).toBe("red")
    // Both reasons should still be present in the tooltip
    expect(r.reasons.length).toBeGreaterThanOrEqual(2)
  })

  it("singular vs plural in issue count phrasing", () => {
    const single = cardHealth(signals({ issueCount: 1 }))
    expect(single.reasons.some((r) => /^1 active issue/.test(r))).toBe(true)
    const many = cardHealth(signals({ issueCount: 7 }))
    expect(many.reasons.some((r) => /^7 active issues/.test(r))).toBe(true)
  })
})

describe("healthCounts", () => {
  it("returns zero counts for an empty list", () => {
    expect(healthCounts([])).toEqual({ total: 0, green: 0, amber: 0, red: 0 })
  })

  it("counts each severity bucket", () => {
    const r = healthCounts(["green", "green", "amber", "red", "red", "red"])
    expect(r).toEqual({ total: 6, green: 2, amber: 1, red: 3 })
  })
})
