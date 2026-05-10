// Cross-domain aggregation helpers for the optional KPI strip on the
// dashboard. Pure functions, no I/O.

/**
 * Element-wise sum across a set of arrays. Used to combine each domain's
 * 30-day daily series into a portfolio-level series for the KPI strip
 * sparkline.
 *
 * Arrays can be different lengths if some domains have less history; the
 * result is the length of the longest input, with shorter inputs treated
 * as zero-padded on the left (oldest end).
 */
export function sumDaily(arrays: number[][]): number[] {
  if (arrays.length === 0) return []
  const maxLen = Math.max(...arrays.map((a) => a.length))
  const out = new Array(maxLen).fill(0) as number[]
  for (const a of arrays) {
    const offset = maxLen - a.length // pad shorter arrays at the start
    for (let i = 0; i < a.length; i++) out[offset + i] += a[i]
  }
  return out
}

/**
 * Impression-weighted average position across domains. Naive averaging would
 * let a tiny site with one impression and position 1 dominate a real site
 * with thousands of impressions and position 12. We weight by impressions so
 * the headline number reflects search traffic reality:
 *   weightedPosition = Σ(position × impressions) / Σ(impressions)
 *
 * Returns null if no domain has any impressions (avoids 0/0).
 */
export function weightedAvgPosition(
  domains: Array<{ position: number; impressions: number }>
): number | null {
  let totalImpressions = 0
  let totalWeighted = 0
  for (const d of domains) {
    if (d.impressions <= 0) continue
    totalImpressions += d.impressions
    totalWeighted += d.position * d.impressions
  }
  if (totalImpressions === 0) return null
  return totalWeighted / totalImpressions
}

/**
 * Compute a percentage delta between two numbers, formatted with sign and
 * single decimal precision. Returns null when either input is null/zero so
 * trend chips can render a placeholder instead of a misleading "Infinity%".
 */
export function pctDelta(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}
