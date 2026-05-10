import type { Database } from "../driver"
import { getDb } from "../index"

/**
 * The set of Google APIs we instrument. Strings are stable identifiers used
 * as the primary key in api_call_counts and as the keys returned from
 * getApiUsageStats() — keep them human-readable.
 */
export type ApiName = "ga4" | "gsc" | "crux" | "psi"

export const API_LIMITS: Record<
  ApiName,
  { label: string; freeLimit: string; href: string }
> = {
  ga4: {
    label: "GA4 Data API",
    freeLimit: "200,000 tokens/day per property",
    href: "https://developers.google.com/analytics/devguides/reporting/data/v1/quotas",
  },
  gsc: {
    label: "Search Console API",
    freeLimit: "30,000 queries/day per project",
    href: "https://developers.google.com/webmaster-tools/limits",
  },
  crux: {
    label: "Chrome UX Report API",
    freeLimit: "~150 queries/minute per project",
    href: "https://developer.chrome.com/docs/crux/api#api_use_and_quotas",
  },
  psi: {
    label: "PageSpeed Insights API",
    freeLimit: "25,000 queries/day per project",
    href: "https://developers.google.com/speed/docs/insights/v5/get-started",
  },
}

function utcDay(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

function utcMonthPrefix(date: Date = new Date()): string {
  return date.toISOString().slice(0, 7) + "-"
}

/**
 * Increment today's counter for the given API. Idempotent upsert; called from
 * each fetcher after a successful response. Failures don't get counted —
 * we want to track real outbound load, not retries.
 *
 * Defaults to opening a fresh DB handle if none provided so call sites
 * outside the request scope (e.g. background runners) can call this without
 * threading the DB handle through.
 */
export function recordApiCall(api: ApiName, db?: Database): void {
  const target = db ?? getDb()
  target.run(
    `INSERT INTO api_call_counts (api, day, count) VALUES (?, ?, 1)
     ON CONFLICT(api, day) DO UPDATE SET count = count + 1`,
    [api, utcDay()]
  )
}

export interface ApiUsageRow {
  api: ApiName
  label: string
  freeLimit: string
  href: string
  today: number
  month: number
}

export function getApiUsageStats(db: Database): ApiUsageRow[] {
  const today = utcDay()
  const monthPrefix = utcMonthPrefix()

  const todayRows = db
    .query<{ api: ApiName; count: number }, [string]>(
      "SELECT api, count FROM api_call_counts WHERE day = ?"
    )
    .all(today)

  const monthRows = db
    .query<{ api: ApiName; total: number }, [string]>(
      `SELECT api, SUM(count) as total FROM api_call_counts
       WHERE day LIKE ? || '%'
       GROUP BY api`
    )
    .all(monthPrefix)

  const todayMap = new Map(todayRows.map((r) => [r.api, r.count]))
  const monthMap = new Map(monthRows.map((r) => [r.api, Number(r.total)]))

  return (Object.keys(API_LIMITS) as ApiName[]).map((api) => ({
    api,
    label: API_LIMITS[api].label,
    freeLimit: API_LIMITS[api].freeLimit,
    href: API_LIMITS[api].href,
    today: todayMap.get(api) ?? 0,
    month: monthMap.get(api) ?? 0,
  }))
}
