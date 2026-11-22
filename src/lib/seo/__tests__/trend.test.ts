import { describe, it, expect } from "vitest"
import {
  classifyTrend,
  combineTrends,
  dayNumber,
  hasEnoughVolume,
  recentVsBaseline,
  sumComparisons,
  type DailyPoint,
} from "../trend"

/** `count` consecutive days ending on `end` (YYYY-MM-DD), oldest first. */
function series(end: string, values: number[], compact = false): DailyPoint[] {
  const endMs = Date.parse(`${end}T00:00:00Z`)
  return values.map((value, i) => {
    const d = new Date(endMs - (values.length - 1 - i) * 86_400_000)
    const iso = d.toISOString().slice(0, 10)
    return { date: compact ? iso.replace(/-/g, "") : iso, value }
  })
}

describe("dayNumber", () => {
  it("parses both API date formats to the same day", () => {
    expect(dayNumber("2026-06-01")).toBe(dayNumber("20260601"))
    expect(dayNumber("2026-06-02")! - dayNumber("2026-06-01")!).toBe(1)
    expect(dayNumber("2026-03-01")! - dayNumber("2026-02-28")!).toBe(1)
  })

  it("rejects junk", () => {
    expect(dayNumber("")).toBeNull()
    expect(dayNumber("yesterday")).toBeNull()
    expect(dayNumber("2026-6-1")).toBeNull()
  })
})

describe("recentVsBaseline", () => {
  it("reports flat traffic as flat", () => {
    const c = recentVsBaseline(series("2026-06-01", Array(27).fill(10)))!
    expect(c.recent).toBeCloseTo(10)
    expect(c.baseline).toBeCloseTo(10)
  })

  it("is not fooled by reporting lag (the 4-days-in-a-7-day-window case)", () => {
    // 27 days of data ending 4 days before "today", steady 10 clicks a day.
    // The nominal method saw 40 clicks / 7 vs 270 / 30 and called it -37%.
    const c = recentVsBaseline(series("2026-06-01", Array(27).fill(10)))!
    expect(c.recent / c.baseline).toBeCloseTo(1)
  })

  it("detects a drop in the last week", () => {
    const values = [...Array(23).fill(10), ...Array(7).fill(5)]
    const c = recentVsBaseline(series("2026-06-01", values))!
    expect(c.recent).toBeCloseTo(5)
    expect(c.baseline).toBeCloseTo((23 * 10 + 7 * 5) / 30)
    expect(c.recent).toBeLessThan(c.baseline)
  })

  it("counts days missing from the series as zero", () => {
    // Only two days reported inside a 30-day span.
    const pts: DailyPoint[] = [
      { date: "2026-05-03", value: 30 },
      { date: "2026-06-01", value: 14 },
    ]
    const c = recentVsBaseline(pts)!
    expect(c.recent).toBeCloseTo(14 / 7)
    expect(c.baseline).toBeCloseTo(44 / 30)
  })

  it("can ignore a partial final day", () => {
    const values = [...Array(29).fill(10), 1] // today so far: 1
    const withToday = recentVsBaseline(series("2026-06-01", values, true))!
    const without = recentVsBaseline(series("2026-06-01", values, true), {
      dropLastDay: true,
    })!
    expect(withToday.recent).toBeLessThan(10)
    expect(without.recent).toBeCloseTo(10)
    expect(without.baseline).toBeCloseTo(10)
  })

  it("accepts unsorted input", () => {
    const pts = series("2026-06-01", [...Array(20).fill(4), ...Array(7).fill(8)]).reverse()
    expect(recentVsBaseline(pts)!.recent).toBeCloseTo(8)
  })

  it("returns null when the series can't support a comparison", () => {
    expect(recentVsBaseline([])).toBeNull()
    expect(recentVsBaseline(series("2026-06-01", Array(7).fill(10)))).toBeNull()
    expect(recentVsBaseline([{ date: "nope", value: 3 }])).toBeNull()
    expect(
      recentVsBaseline(series("2026-06-01", [5]), { dropLastDay: true })
    ).toBeNull()
  })
})

describe("classifyTrend", () => {
  it("applies the threshold in both directions", () => {
    expect(classifyTrend({ recent: 89, baseline: 100 })).toBe("down")
    expect(classifyTrend({ recent: 91, baseline: 100 })).toBe("flat")
    expect(classifyTrend({ recent: 109, baseline: 100 })).toBe("flat")
    expect(classifyTrend({ recent: 110, baseline: 100 })).toBe("up")
    expect(classifyTrend({ recent: 96, baseline: 100 }, { thresholdPct: 3 })).toBe("down")
  })

  it("refuses to judge tiny volumes", () => {
    // ~3 visits a week halving is noise, not a trend.
    expect(classifyTrend({ recent: 0.2, baseline: 0.4 })).toBeNull()
    expect(classifyTrend({ recent: 0.2, baseline: 0.4 }, { minWeeklyVolume: 1 })).toBe("down")
  })

  it("handles a zero baseline and a missing comparison", () => {
    expect(classifyTrend({ recent: 5, baseline: 0 })).toBe("up")
    expect(classifyTrend(null)).toBeNull()
  })
})

describe("hasEnoughVolume", () => {
  it("needs about ten events a week on at least one side", () => {
    expect(hasEnoughVolume({ recent: 2 / 7, baseline: 1 / 30 })).toBe(false)
    expect(hasEnoughVolume({ recent: 10 / 7, baseline: 0 })).toBe(true)
    expect(hasEnoughVolume({ recent: 0, baseline: 2 })).toBe(true)
    expect(hasEnoughVolume(null)).toBe(false)
  })
})

describe("combineTrends", () => {
  it("lets any drop win", () => {
    expect(combineTrends(["up", "down"])).toBe("down")
    expect(combineTrends(["flat", "down"])).toBe("down")
  })

  it("reports growth only when nothing fell", () => {
    expect(combineTrends(["up", "flat"])).toBe("up")
    expect(combineTrends(["up", null])).toBe("up")
    expect(combineTrends(["flat", "flat"])).toBe("flat")
  })

  it("is null when nothing could be judged", () => {
    expect(combineTrends([null, null])).toBeNull()
    expect(combineTrends([])).toBeNull()
  })
})

describe("sumComparisons", () => {
  it("adds rates and skips domains without data", () => {
    expect(
      sumComparisons([{ recent: 5, baseline: 10 }, null, { recent: 20, baseline: 10 }])
    ).toEqual({ recent: 25, baseline: 20 })
    expect(sumComparisons([null, null])).toBeNull()
  })
})
