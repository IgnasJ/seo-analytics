import { describe, it, expect } from "vitest"
import { expectedCtrAt, recommendationFor } from "../recommendations"
import type { OpportunityRow } from "../opportunities"

function row(overrides: Partial<OpportunityRow> = {}): OpportunityRow {
  return {
    query: "test query",
    clicks: 10,
    impressions: 1000,
    ctr: 0.01,
    position: 8,
    opportunityScore: 0,
    ...overrides,
  }
}

describe("expectedCtrAt", () => {
  it("returns highest CTR at position 1", () => {
    expect(expectedCtrAt(1)).toBe(0.3)
  })

  it("monotonically decreases with position", () => {
    const positions = [1, 2, 3, 5, 8, 10, 12, 15, 20, 25]
    let prev = Infinity
    for (const p of positions) {
      const ctr = expectedCtrAt(p)
      expect(ctr).toBeLessThanOrEqual(prev)
      prev = ctr
    }
  })

  it("clamps below 1% past position 10", () => {
    expect(expectedCtrAt(15)).toBeLessThan(0.02)
    expect(expectedCtrAt(25)).toBeLessThan(0.01)
  })
})

describe("recommendationFor", () => {
  it("flags page-1 keywords as on-page-tweak opportunities", () => {
    const r = recommendationFor(row({ position: 6, ctr: 0.04 }))
    expect(r.diagnosis).toMatch(/page 1/i)
    expect(r.actions.some((a) => /on-page|H1|meta title/i.test(a))).toBe(true)
  })

  it("flags page-2 keywords as needing backlinks / depth", () => {
    const r = recommendationFor(row({ position: 14, ctr: 0.005 }))
    expect(r.diagnosis).toMatch(/page 2|page-2/i)
    expect(r.actions.some((a) => /backlink|cluster|supporting/i.test(a))).toBe(true)
  })

  it("adds a CTR-rewrite action when CTR is below 1%", () => {
    const r = recommendationFor(row({ position: 8, ctr: 0.005 }))
    expect(
      r.actions.some((a) => /rewrite|title|snippet|intent/i.test(a))
    ).toBe(true)
  })

  it("estimates positive potential clicks for page-1 underperformers", () => {
    const r = recommendationFor(
      row({ position: 8, impressions: 1000, ctr: 0.02 })
    )
    // expectedAtTop3 = 0.12; expectedAtCurrent ~= 0.038
    // uplift ~= 0.082; clicks ~= 82
    expect(r.potentialClicks).toBeGreaterThan(50)
    expect(r.potentialClicks).toBeLessThan(150)
  })

  it("estimates much larger uplift for page-2 keywords with many impressions", () => {
    const r = recommendationFor(
      row({ position: 15, impressions: 5000, ctr: 0.005 })
    )
    expect(r.potentialClicks).toBeGreaterThan(500)
  })

  it("never returns negative potential clicks", () => {
    const r = recommendationFor(
      row({ position: 4, impressions: 100, ctr: 0.5 }) // already crushing it
    )
    expect(r.potentialClicks).toBeGreaterThanOrEqual(0)
  })
})
