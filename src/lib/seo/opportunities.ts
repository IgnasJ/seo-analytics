import type { QueryRow, QueryPageRow } from "@/types/search-console"

export interface OpportunityRow extends QueryRow {
  opportunityScore: number
  page?: string
}

export function computeOpportunities(
  queries: QueryRow[],
  queryPages?: QueryPageRow[]
): OpportunityRow[] {
  const candidates = queries.filter((q) => q.position >= 4 && q.position <= 20)
  if (candidates.length === 0) return []

  const impressions = candidates.map((q) => q.impressions).sort((a, b) => a - b)
  const medianImpressions = impressions[Math.floor(impressions.length / 2)]
  const avgCtr = candidates.reduce((s, q) => s + q.ctr, 0) / candidates.length

  // Build a lookup: query → best page (highest impressions among queryPages for that query)
  const bestPage = new Map<string, string>()
  if (queryPages) {
    const grouped = new Map<string, QueryPageRow[]>()
    for (const qp of queryPages) {
      const list = grouped.get(qp.query) ?? []
      list.push(qp)
      grouped.set(qp.query, list)
    }
    for (const [q, pages] of grouped) {
      const best = pages.sort((a, b) => b.impressions - a.impressions)[0]
      bestPage.set(q, best.page)
    }
  }

  return candidates
    .filter((q) => q.impressions >= medianImpressions && q.ctr <= avgCtr)
    .map((q) => ({
      ...q,
      opportunityScore: Math.round(
        (q.impressions / (q.position * Math.max(q.ctr, 0.001))) * 10
      ),
      page: bestPage.get(q.query),
    }))
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
}
