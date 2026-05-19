import { describe, it, expect } from "vitest"
import { computeOpportunities } from "../opportunities"
import type { QueryRow, QueryPageRow } from "@/types/search-console"

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

describe("computeOpportunities with queryPages", () => {
  it("attaches the best-matching page URL to each opportunity", () => {
    const queries: QueryRow[] = [
      // low CTR = opportunity candidate; high impressions passes median filter
      { query: "fast page speed", clicks: 3, impressions: 500, ctr: 0.006, position: 8 },
      { query: "seo analytics", clicks: 10, impressions: 300, ctr: 0.02, position: 12.5 },
    ]
    const queryPages: QueryPageRow[] = [
      { query: "fast page speed", page: "https://example.com/speed", clicks: 8, impressions: 400, ctr: 0.006, position: 7 },
      { query: "fast page speed", page: "https://example.com/other", clicks: 2, impressions: 100, ctr: 0.006, position: 12 },
    ]
    const result = computeOpportunities(queries, queryPages)
    // At least one result should have the page attached
    const speedResult = result.find((r) => r.query === "fast page speed")
    expect(speedResult?.page).toBe("https://example.com/speed")
  })

  it("leaves page undefined when queryPages is not provided", () => {
    const queries: QueryRow[] = [
      // low CTR passes filter; high impressions passes median
      { query: "test", clicks: 4, impressions: 500, ctr: 0.007, position: 7 },
      { query: "test2", clicks: 5, impressions: 400, ctr: 0.011, position: 9 },
    ]
    const result = computeOpportunities(queries)
    expect(result[0].page).toBeUndefined()
  })
})
