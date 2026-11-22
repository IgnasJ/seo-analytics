// Query movers: which search queries moved the most in the last few days,
// compared with the weeks just before. Pure functions, no I/O.
//
// No history table is needed. Every sync already stores the query list for a
// 7-day and a 30-day window that end on the same day, so the 30-day figures
// minus the 7-day figures *are* the preceding weeks:
//
//   prior impressions = impressions(30d) − impressions(7d)
//   prior position    = (pos30 × impr30 − pos7 × impr7) / prior impressions
//
// (Search Console's position is an impression-weighted average, so the
// weighted subtraction recovers the earlier window exactly.)

import type { QueryRow } from "@/types/search-console"
import { expectedCtrAt } from "./recommendations"
import { dayNumber } from "./trend"

export interface QueryMover {
  query: string
  /** Average position in the earlier window and in the recent one. */
  priorPosition: number
  recentPosition: number
  /** recent − prior. Negative = moved up the results page. */
  positionDelta: number
  /** Impressions per day in each window. */
  priorImpressionsPerDay: number
  recentImpressionsPerDay: number
  recentClicks: number
  /**
   * Rough clicks/day gained (+) or lost (−) from the rank change alone, using
   * the typical click-through rate at each position. Only used to rank movers
   * so that a jump from 12 to 6 on a busy query outranks 80 to 60 on a rare one.
   */
  impact: number
}

export interface NewQuery {
  query: string
  position: number
  impressionsPerDay: number
  clicks: number
}

export interface LostQuery {
  query: string
  priorPosition: number
  priorImpressionsPerDay: number
}

export interface QueryMovers {
  /** Days of data in the recent window and in the earlier one. */
  recentDays: number
  priorDays: number
  rising: QueryMover[]
  falling: QueryMover[]
  /** Queries with impressions only in the recent window. */
  fresh: NewQuery[]
  /** Queries that had steady impressions before and none recently. */
  lost: LostQuery[]
}

export interface QuerySnapshot {
  queries: QueryRow[]
  /** Dates ("YYYY-MM-DD") that have data in this window. */
  dates: string[]
  /** Unix seconds when the window was fetched. */
  syncedAt: number
}

export interface MoverOptions {
  /** Rows per list. Default 8. */
  limit?: number
  /** Minimum impressions in the recent window to trust its position. Default 3. */
  minRecentImpressions?: number
  /** Minimum impressions in the earlier window. Default 10. */
  minPriorImpressions?: number
  /** Smallest position change worth listing. Default 1.5. */
  minPositionDelta?: number
  /** Expected recent impressions a vanished query must have had. Default 4. */
  minLostImpressions?: number
}

/** The query list is requested with a 500-row cap; a full list may be cut off. */
const QUERY_ROW_LIMIT = 500
const NOMINAL_RECENT_DAYS = 7
const NOMINAL_BASELINE_DAYS = 30
const MAX_SYNC_GAP_SECONDS = 6 * 60 * 60

/**
 * How many days of data the recent window really holds. Search Console lags by
 * a few days, so a "7 day" window fetched today typically contains about four.
 * Both windows end on the same (newest available) date, which leaves the
 * earlier window at a constant 30 − 7 = 23 days.
 */
function recentDataDays(baseline: QuerySnapshot): number | null {
  let last = -Infinity
  for (const date of baseline.dates) {
    const day = dayNumber(date)
    if (day !== null && day > last) last = day
  }
  if (!Number.isFinite(last)) return null
  const syncDay = Math.floor(baseline.syncedAt / 86_400)
  const days = last - (syncDay - NOMINAL_RECENT_DAYS) + 1
  if (days < 1) return null
  return Math.min(days, NOMINAL_RECENT_DAYS + 1)
}

/**
 * Compare the 7-day query snapshot with the 30-day one. Returns null when the
 * comparison can't be made honestly: a window is missing, the two were fetched
 * at different times (so they don't end on the same day), or the recent window
 * has no data yet.
 */
export function computeQueryMovers(
  recent: QuerySnapshot | null,
  baseline: QuerySnapshot | null,
  options: MoverOptions = {}
): QueryMovers | null {
  if (!recent || !baseline) return null
  if (Math.abs(recent.syncedAt - baseline.syncedAt) > MAX_SYNC_GAP_SECONDS) return null

  const recentDays = recentDataDays(baseline)
  if (recentDays === null) return null
  const priorDays = NOMINAL_BASELINE_DAYS - NOMINAL_RECENT_DAYS

  const limit = options.limit ?? 8
  const minRecentImpressions = options.minRecentImpressions ?? 3
  const minPriorImpressions = options.minPriorImpressions ?? 10
  const minPositionDelta = options.minPositionDelta ?? 1.5
  const minLostImpressions = options.minLostImpressions ?? 4

  const recentByQuery = new Map<string, QueryRow>()
  for (const row of recent.queries) recentByQuery.set(row.query, row)

  // If the recent list hit the row cap, a query missing from it may simply
  // have been cut off, so "lost" can't be concluded.
  const recentListComplete = recent.queries.length < QUERY_ROW_LIMIT

  const rising: QueryMover[] = []
  const falling: QueryMover[] = []
  const fresh: NewQuery[] = []
  const lost: LostQuery[] = []

  for (const base of baseline.queries) {
    const now = recentByQuery.get(base.query)
    const recentImpressions = now?.impressions ?? 0
    const priorImpressions = base.impressions - recentImpressions

    if (priorImpressions < 1) {
      // Every impression of this query falls inside the recent window.
      if (now && recentImpressions >= minRecentImpressions) {
        fresh.push({
          query: base.query,
          position: now.position,
          impressionsPerDay: recentImpressions / recentDays,
          clicks: now.clicks,
        })
      }
      continue
    }

    const priorPosition = Math.max(
      1,
      (base.position * base.impressions - (now?.position ?? 0) * recentImpressions) /
        priorImpressions
    )
    const priorImpressionsPerDay = priorImpressions / priorDays

    if (!now || recentImpressions === 0) {
      if (
        recentListComplete &&
        priorImpressions >= minPriorImpressions &&
        priorImpressionsPerDay * recentDays >= minLostImpressions
      ) {
        lost.push({ query: base.query, priorPosition, priorImpressionsPerDay })
      }
      continue
    }

    if (
      recentImpressions < minRecentImpressions ||
      priorImpressions < minPriorImpressions
    ) {
      continue
    }

    const positionDelta = now.position - priorPosition
    if (Math.abs(positionDelta) < minPositionDelta) continue

    const recentImpressionsPerDay = recentImpressions / recentDays
    const mover: QueryMover = {
      query: base.query,
      priorPosition,
      recentPosition: now.position,
      positionDelta,
      priorImpressionsPerDay,
      recentImpressionsPerDay,
      recentClicks: now.clicks,
      impact:
        (expectedCtrAt(now.position) - expectedCtrAt(priorPosition)) *
        ((priorImpressionsPerDay + recentImpressionsPerDay) / 2),
    }
    if (positionDelta < 0) rising.push(mover)
    else falling.push(mover)
  }

  // Biggest estimated traffic effect first. Past position 20 the expected CTR
  // is flat, so ties are broken by how far the query moved times how often it
  // is shown.
  const weight = (m: QueryMover) =>
    Math.abs(m.positionDelta) * (m.priorImpressionsPerDay + m.recentImpressionsPerDay)
  rising.sort((a, b) => b.impact - a.impact || weight(b) - weight(a))
  falling.sort((a, b) => a.impact - b.impact || weight(b) - weight(a))
  fresh.sort((a, b) => b.impressionsPerDay - a.impressionsPerDay)
  lost.sort((a, b) => b.priorImpressionsPerDay - a.priorImpressionsPerDay)

  return {
    recentDays,
    priorDays,
    rising: rising.slice(0, limit),
    falling: falling.slice(0, limit),
    fresh: fresh.slice(0, limit),
    lost: lost.slice(0, limit),
  }
}
