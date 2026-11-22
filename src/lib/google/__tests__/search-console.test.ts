import { describe, it, expect, vi } from "vitest"

// search-console.ts imports the googleapis client and the DB-backed usage
// counter at module load; neither is needed for the pure overview maths.
vi.mock("googleapis", () => ({ google: {} }))
vi.mock("@/lib/db/queries/api-usage", () => ({ recordApiCall: vi.fn() }))

import { computeGscOverview } from "../search-console"
import type { QueryRow } from "@/types/search-console"

const q = (clicks: number, impressions: number, position: number): QueryRow => ({
  query: "x",
  clicks,
  impressions,
  ctr: impressions ? clicks / impressions : 0,
  position,
})

describe("computeGscOverview", () => {
  it("takes totals from the daily rows, not the truncated query list", () => {
    const daily = [
      { clicks: 100, impressions: 1000, position: 10 },
      { clicks: 50, impressions: 1000, position: 20 },
    ]
    // The query dimension only exposes part of the traffic.
    const queries = [q(20, 300, 3)]
    const o = computeGscOverview(daily, queries)
    expect(o.totalClicks).toBe(150)
    expect(o.totalImpressions).toBe(2000)
    expect(o.avgCtr).toBeCloseTo(0.075)
    expect(o.avgPosition).toBeCloseTo(15)
  })

  it("weights average position by impressions", () => {
    const daily = [
      { clicks: 0, impressions: 9000, position: 2 },
      { clicks: 0, impressions: 1000, position: 52 },
    ]
    // A plain mean would say 27; the traffic-weighted answer is 7.
    expect(computeGscOverview(daily, []).avgPosition).toBeCloseTo(7)
  })

  it("falls back to query rows when no daily rows came back", () => {
    const o = computeGscOverview([], [q(10, 100, 4), q(0, 300, 8)])
    expect(o.totalClicks).toBe(10)
    expect(o.totalImpressions).toBe(400)
    expect(o.avgPosition).toBeCloseTo(7)
  })

  it("returns zeros for an empty report", () => {
    expect(computeGscOverview([], [])).toEqual({
      totalClicks: 0,
      totalImpressions: 0,
      avgCtr: 0,
      avgPosition: 0,
    })
  })
})
