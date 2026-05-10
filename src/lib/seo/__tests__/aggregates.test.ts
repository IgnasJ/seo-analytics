import { describe, it, expect } from "vitest"
import { sumDaily, weightedAvgPosition, pctDelta } from "../aggregates"

describe("sumDaily", () => {
  it("returns an empty array when no inputs", () => {
    expect(sumDaily([])).toEqual([])
  })

  it("sums equal-length arrays element-wise", () => {
    expect(sumDaily([[1, 2, 3], [4, 5, 6]])).toEqual([5, 7, 9])
  })

  it("zero-pads shorter arrays at the start (oldest end)", () => {
    // The single-element array represents one day of history; it should
    // line up with the most recent day in the longer array.
    expect(sumDaily([[10, 20, 30], [5]])).toEqual([10, 20, 35])
  })

  it("handles mixed lengths", () => {
    expect(sumDaily([[1, 1, 1, 1], [2, 2], [3]])).toEqual([1, 1, 3, 6])
  })
})

describe("weightedAvgPosition", () => {
  it("returns null when no domains have impressions", () => {
    expect(weightedAvgPosition([])).toBeNull()
    expect(
      weightedAvgPosition([{ position: 5, impressions: 0 }])
    ).toBeNull()
  })

  it("matches simple average when all weights are equal", () => {
    const r = weightedAvgPosition([
      { position: 4, impressions: 100 },
      { position: 6, impressions: 100 },
      { position: 8, impressions: 100 },
    ])
    expect(r).toBeCloseTo(6, 5)
  })

  it("weights big sites more than tiny ones", () => {
    // A big site at position 10 with 10000 impressions should dominate
    // a tiny site at position 1 with 1 impression.
    const r = weightedAvgPosition([
      { position: 1, impressions: 1 },
      { position: 10, impressions: 10000 },
    ])
    // (1*1 + 10*10000) / (1 + 10000) ≈ 9.999
    expect(r).toBeGreaterThan(9.5)
  })

  it("ignores domains with zero impressions", () => {
    const r = weightedAvgPosition([
      { position: 1, impressions: 0 },
      { position: 5, impressions: 100 },
    ])
    expect(r).toBe(5)
  })
})

describe("pctDelta", () => {
  it("returns positive percentage for growth", () => {
    expect(pctDelta(110, 100)).toBeCloseTo(10, 5)
  })

  it("returns negative percentage for decline", () => {
    expect(pctDelta(80, 100)).toBeCloseTo(-20, 5)
  })

  it("returns null when previous is zero", () => {
    expect(pctDelta(50, 0)).toBeNull()
  })

  it("returns null on non-finite inputs", () => {
    expect(pctDelta(NaN, 100)).toBeNull()
    expect(pctDelta(50, Infinity)).toBeNull()
  })
})
