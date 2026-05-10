import { describe, it, expect } from "vitest"
import { isStale } from "../sync"

describe("isStale", () => {
  it("returns true when lastSyncedAt is null", () => {
    expect(isStale(null)).toBe(true)
  })

  it("returns true when last sync was over 24 hours ago", () => {
    const twoDaysAgo = Math.floor(Date.now() / 1000) - 48 * 60 * 60
    expect(isStale(twoDaysAgo)).toBe(true)
  })

  it("returns false when last sync was recent", () => {
    const oneHourAgo = Math.floor(Date.now() / 1000) - 3600
    expect(isStale(oneHourAgo)).toBe(false)
  })
})
