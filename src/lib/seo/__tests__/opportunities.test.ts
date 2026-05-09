import { describe, it, expect } from "bun:test"
import { computeOpportunities } from "../opportunities"
import type { QueryRow } from "@/types/search-console"

describe("computeOpportunities", () => {
  const queries: QueryRow[] = [
    { query: "best seo tool", clicks: 5, impressions: 500, ctr: 0.01, position: 7.2 },
    { query: "seo analytics", clicks: 2, impressions: 300, ctr: 0.006, position: 12.5 },
    { query: "top ranking tool", clicks: 50, impressions: 600, ctr: 0.083, position: 1.5 },
    { query: "free analytics", clicks: 1, impressions: 80, ctr: 0.012, position: 9.8 },
    { query: "obscure phrase", clicks: 0, impressions: 5, ctr: 0, position: 18 },
  ]

  it("returns keywords in position 4-20 with impressions above threshold", () => {
    const results = computeOpportunities(queries)
    const positions = results.map((r) => r.position)
    expect(positions.every((p) => p >= 4 && p <= 20)).toBe(true)
  })

  it("excludes keywords with high CTR relative to their peers", () => {
    const results = computeOpportunities(queries)
    // 'top ranking tool' is position 1.5, should not appear
    expect(results.find((r) => r.query === "top ranking tool")).toBeUndefined()
  })

  it("excludes keywords below median impressions", () => {
    const results = computeOpportunities(queries)
    // 'obscure phrase' has only 5 impressions — below median
    expect(results.find((r) => r.query === "obscure phrase")).toBeUndefined()
  })

  it("includes an opportunityScore field", () => {
    const results = computeOpportunities(queries)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]).toHaveProperty("opportunityScore")
  })
})
