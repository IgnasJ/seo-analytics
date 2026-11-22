import { describe, it, expect } from "vitest"
import { computeQueryMovers, type QuerySnapshot } from "../movers"
import type { QueryRow } from "@/types/search-console"

// Sync happened on 2026-06-05; Search Console had data up to 2026-06-01, so
// the "7 day" window (starting 2026-05-29) really holds 4 days.
const SYNCED_AT = Date.UTC(2026, 5, 5, 21, 0, 0) / 1000

function dates(from: string, count: number): string[] {
  const start = Date.parse(`${from}T00:00:00Z`)
  return Array.from({ length: count }, (_, i) =>
    new Date(start + i * 86_400_000).toISOString().slice(0, 10)
  )
}

const q = (query: string, impressions: number, position: number, clicks = 0): QueryRow => ({
  query,
  clicks,
  impressions,
  ctr: impressions ? clicks / impressions : 0,
  position,
})

function snap(queries: QueryRow[], opts: Partial<QuerySnapshot> = {}): QuerySnapshot {
  return { queries, dates: dates("2026-05-06", 27), syncedAt: SYNCED_AT, ...opts }
}

/** 30-day row for a query, given its earlier-window and recent-window figures. */
function combined(
  query: string,
  prior: { impressions: number; position: number },
  recent: { impressions: number; position: number }
): QueryRow {
  const impressions = prior.impressions + recent.impressions
  const position =
    (prior.position * prior.impressions + recent.position * recent.impressions) / impressions
  return q(query, impressions, position)
}

describe("computeQueryMovers", () => {
  it("derives the window lengths from the newest data date", () => {
    const m = computeQueryMovers(snap([]), snap([]))!
    expect(m.recentDays).toBe(4)
    expect(m.priorDays).toBe(23)
  })

  it("recovers the earlier position and classifies rising / falling", () => {
    const recent = snap([q("up", 40, 5), q("down", 40, 18)])
    const baseline = snap([
      combined("up", { impressions: 230, position: 12 }, { impressions: 40, position: 5 }),
      combined("down", { impressions: 230, position: 8 }, { impressions: 40, position: 18 }),
    ])
    const m = computeQueryMovers(recent, baseline)!

    expect(m.rising).toHaveLength(1)
    expect(m.rising[0].query).toBe("up")
    expect(m.rising[0].priorPosition).toBeCloseTo(12)
    expect(m.rising[0].recentPosition).toBeCloseTo(5)
    expect(m.rising[0].positionDelta).toBeCloseTo(-7)
    expect(m.rising[0].priorImpressionsPerDay).toBeCloseTo(10)
    expect(m.rising[0].recentImpressionsPerDay).toBeCloseTo(10)
    expect(m.rising[0].impact).toBeGreaterThan(0)

    expect(m.falling).toHaveLength(1)
    expect(m.falling[0].query).toBe("down")
    expect(m.falling[0].positionDelta).toBeCloseTo(10)
    expect(m.falling[0].impact).toBeLessThan(0)
  })

  it("ranks movers by traffic effect, not by raw position change", () => {
    const recent = snap([q("busy", 400, 4), q("rare", 4, 30)])
    const baseline = snap([
      combined("busy", { impressions: 2300, position: 8 }, { impressions: 400, position: 4 }),
      combined("rare", { impressions: 23, position: 70 }, { impressions: 4, position: 30 }),
    ])
    const m = computeQueryMovers(recent, baseline)!
    expect(m.rising.map((r) => r.query)).toEqual(["busy", "rare"])
  })

  it("ignores small moves and thinly-observed queries", () => {
    const recent = snap([q("steady", 40, 7.5), q("thin-recent", 1, 3), q("thin-prior", 40, 3)])
    const baseline = snap([
      combined("steady", { impressions: 230, position: 8 }, { impressions: 40, position: 7.5 }),
      combined("thin-recent", { impressions: 230, position: 20 }, { impressions: 1, position: 3 }),
      combined("thin-prior", { impressions: 4, position: 20 }, { impressions: 40, position: 3 }),
    ])
    const m = computeQueryMovers(recent, baseline)!
    expect(m.rising).toEqual([])
    expect(m.falling).toEqual([])
  })

  it("lists queries seen only in the recent window as new", () => {
    const recent = snap([q("brand new", 12, 9, 2)])
    const baseline = snap([q("brand new", 12, 9, 2)])
    const m = computeQueryMovers(recent, baseline)!
    expect(m.fresh).toEqual([
      { query: "brand new", position: 9, impressionsPerDay: 3, clicks: 2 },
    ])
    expect(m.rising).toEqual([])
  })

  it("lists queries that vanished, but only if they were shown often enough", () => {
    const recent = snap([])
    const baseline = snap([q("gone", 230, 6), q("always rare", 12, 6)])
    const m = computeQueryMovers(recent, baseline)!
    expect(m.lost.map((l) => l.query)).toEqual(["gone"])
    expect(m.lost[0].priorPosition).toBeCloseTo(6)
    expect(m.lost[0].priorImpressionsPerDay).toBeCloseTo(10)
  })

  it("does not call a query lost when the recent list was cut off at the row cap", () => {
    const filler = Array.from({ length: 500 }, (_, i) => q(`filler ${i}`, 5, 10))
    const baseline = snap([...filler, q("gone?", 230, 6)])
    const m = computeQueryMovers(snap(filler), baseline)!
    expect(m.lost).toEqual([])
  })

  it("caps each list", () => {
    const names = Array.from({ length: 12 }, (_, i) => `q${i}`)
    const recent = snap(names.map((n) => q(n, 40, 5)))
    const baseline = snap(
      names.map((n) => combined(n, { impressions: 230, position: 12 }, { impressions: 40, position: 5 }))
    )
    expect(computeQueryMovers(recent, baseline)!.rising).toHaveLength(8)
    expect(computeQueryMovers(recent, baseline, { limit: 3 })!.rising).toHaveLength(3)
  })

  it("refuses to compare windows that don't line up", () => {
    expect(computeQueryMovers(null, snap([]))).toBeNull()
    expect(computeQueryMovers(snap([]), null)).toBeNull()
    // fetched a day apart -> they end on different dates
    expect(
      computeQueryMovers(snap([], { syncedAt: SYNCED_AT - 86_400 }), snap([]))
    ).toBeNull()
    // no dated rows at all
    expect(computeQueryMovers(snap([]), snap([], { dates: [] }))).toBeNull()
  })
})
