import { describe, it, expect } from "vitest"
import { formatCompact, formatDateTime, formatInteger } from "../format"

describe("formatDateTime", () => {
  it("formats Unix seconds to yyyy-MM-dd HH:mm:ss in local time", () => {
    // Build a Unix-seconds value from a known local date so the assertion
    // doesn't depend on the test runner's timezone.
    const d = new Date(2026, 4, 10, 13, 6, 6) // May is month index 4
    const unix = Math.floor(d.getTime() / 1000)
    expect(formatDateTime(unix)).toBe("2026-05-10 13:06:06")
  })

  it("zero-pads single-digit components", () => {
    const d = new Date(2024, 0, 1, 1, 2, 3)
    expect(formatDateTime(Math.floor(d.getTime() / 1000))).toBe(
      "2024-01-01 01:02:03"
    )
  })

  it("uses 24-hour clock", () => {
    const d = new Date(2024, 5, 15, 23, 59, 59)
    expect(formatDateTime(Math.floor(d.getTime() / 1000))).toBe(
      "2024-06-15 23:59:59"
    )
  })
})

describe("formatInteger", () => {
  it("groups thousands with comma regardless of host locale", () => {
    expect(formatInteger(1801)).toBe("1,801")
    expect(formatInteger(1_234_567)).toBe("1,234,567")
  })

  it("rounds non-integers", () => {
    expect(formatInteger(123.7)).toBe("124")
  })

  it("returns dash for null / undefined / non-finite", () => {
    expect(formatInteger(null)).toBe("—")
    expect(formatInteger(undefined)).toBe("—")
    expect(formatInteger(NaN)).toBe("—")
    expect(formatInteger(Infinity)).toBe("—")
  })
})

describe("formatCompact", () => {
  it("uses comma grouping for small values", () => {
    expect(formatCompact(123)).toBe("123")
    expect(formatCompact(9_999)).toBe("9,999")
  })

  it("abbreviates with K past 10k", () => {
    expect(formatCompact(12_400)).toBe("12.4K")
    expect(formatCompact(999_000)).toBe("999.0K")
  })

  it("abbreviates with M past 1M", () => {
    expect(formatCompact(1_500_000)).toBe("1.5M")
  })

  it("returns dash for null", () => {
    expect(formatCompact(null)).toBe("—")
  })
})
