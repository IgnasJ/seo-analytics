import type { QueryRow } from "@/types/search-console"

export interface OpportunityRow extends QueryRow {
  opportunityScore: number
}

export function computeOpportunities(queries: QueryRow[]): OpportunityRow[] {
  const candidates = queries.filter((q) => q.position >= 4 && q.position <= 20)
  if (candidates.length === 0) return []

  const impressions = candidates.map((q) => q.impressions).sort((a, b) => a - b)
  const medianImpressions = impressions[Math.floor(impressions.length / 2)]

  const avgCtr = candidates.reduce((s, q) => s + q.ctr, 0) / candidates.length

  return candidates
    .filter((q) => q.impressions >= medianImpressions && q.ctr <= avgCtr)
    .map((q) => ({
      ...q,
      opportunityScore: Math.round(
        (q.impressions / (q.position * Math.max(q.ctr, 0.001))) * 10
      ),
    }))
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
}
