import { describe, it, expect } from "vitest"
import { formatDateTime } from "../format"

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
