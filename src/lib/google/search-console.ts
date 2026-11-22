import { google } from "googleapis"
import type { GscReport, QueryRow, GscPageRow, DailyGscRow, PositionBuckets, QueryPageRow, IssuesReport, SitemapInfo, CwvMetric } from "@/types/search-console"
import { recordApiCall } from "@/lib/db/queries/api-usage"
import { GOOGLE_REQUEST_OPTIONS, GOOGLE_REQUEST_TIMEOUT_MS } from "./request-options"

export async function fetchGSCReport(
  siteUrl: string,
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<GscReport> {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const webmasters = google.webmasters({ version: "v3", auth })

  const [queriesRes, pagesRes, dailyRes, queryPagesRes] = await Promise.all([
    webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ["query"],
        // Bumped from 25 → 500 so the Top Queries table can paginate and the
        // Opportunities engine has more data to find quick-wins in.
        rowLimit: 500,
        aggregationType: "byPage",
      },
    }, GOOGLE_REQUEST_OPTIONS),
    webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ["page"],
        rowLimit: 500,
      },
    }, GOOGLE_REQUEST_OPTIONS),
    webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ["date"],
        rowLimit: 500,
      },
    }, GOOGLE_REQUEST_OPTIONS),
    webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ["query", "page"],
        rowLimit: 1000,
        aggregationType: "byPage",
      },
    }, GOOGLE_REQUEST_OPTIONS),
  ])

  // Four GSC searchanalytics calls above run concurrently.
  recordApiCall("gsc", undefined, 4)

  const queryRows: QueryRow[] = (queriesRes.data.rows ?? []).map((r) => ({
    query: r.keys?.[0] ?? "",
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }))

  const topPages: GscPageRow[] = (pagesRes.data.rows ?? []).map((r) => ({
    page: r.keys?.[0] ?? "",
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }))

  const daily: DailyGscRow[] = (dailyRes.data.rows ?? []).map((r) => ({
    date: r.keys?.[0] ?? "",
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
  }))

  const queryPages: QueryPageRow[] = (queryPagesRes.data.rows ?? []).map((r) => ({
    query: r.keys?.[0] ?? "",
    page: r.keys?.[1] ?? "",
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }))

  const { totalClicks, totalImpressions, avgCtr, avgPosition } = computeGscOverview(
    dailyRes.data.rows ?? [],
    queryRows
  )

  const positionBuckets: PositionBuckets = {
    top3: queryRows.filter((r) => r.position <= 3).length,
    page1: queryRows.filter((r) => r.position > 3 && r.position <= 10).length,
    page2: queryRows.filter((r) => r.position > 10 && r.position <= 20).length,
    beyond: queryRows.filter((r) => r.position > 20).length,
  }

  return {
    overview: { totalClicks, totalImpressions, avgCtr, avgPosition },
    topQueries: queryRows,
    topPages,
    daily,
    positionBuckets,
    queryPages,
  }
}

interface RawGscRow {
  clicks?: number | null
  impressions?: number | null
  position?: number | null
}

/**
 * Site-level headline numbers for a GSC report.
 *
 * Totals come from the per-day rows, which cover *all* search traffic. They
 * used to be summed over the top-500 query rows, which under-reports: Search
 * Console withholds anonymised queries from the query dimension and the list
 * is truncated at 500, so sites with a long tail showed a fraction of their
 * real clicks. Average position is impression-weighted (the definition Search
 * Console itself uses) rather than a plain mean over query rows, where a
 * one-impression query counted as much as a ten-thousand-impression one.
 *
 * Falls back to the query rows when no daily rows came back.
 */
export function computeGscOverview(
  dailyRows: RawGscRow[],
  queryRows: QueryRow[]
): GscReport["overview"] {
  const source: RawGscRow[] = dailyRows.length > 0 ? dailyRows : queryRows

  let totalClicks = 0
  let totalImpressions = 0
  let weightedPosition = 0
  for (const r of source) {
    const impressions = r.impressions ?? 0
    totalClicks += r.clicks ?? 0
    totalImpressions += impressions
    weightedPosition += (r.position ?? 0) * impressions
  }

  return {
    totalClicks,
    totalImpressions,
    avgCtr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
    avgPosition: totalImpressions > 0 ? weightedPosition / totalImpressions : 0,
  }
}

export async function fetchSitemaps(siteUrl: string, accessToken: string): Promise<SitemapInfo[]> {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const webmasters = google.webmasters({ version: "v3", auth })

  const res = await webmasters.sitemaps.list({ siteUrl }, GOOGLE_REQUEST_OPTIONS)
  recordApiCall("gsc")
  return (res.data.sitemap ?? []).map((s) => ({
    path: s.path ?? "",
    errors: s.errors ? Number(s.errors) : 0,
    warnings: s.warnings ? Number(s.warnings) : 0,
    indexed: s.contents?.[0]?.indexed ? Number(s.contents[0].indexed) : 0,
    submitted: s.contents?.[0]?.submitted ? Number(s.contents[0].submitted) : 0,
  }))
}

export async function fetchCrUX(origin: string, cruxApiKey: string): Promise<IssuesReport["cwv"]> {
  // No key configured: the API would only answer 4xx, so don't spend a request
  // (and a quota tick) on it.
  if (!cruxApiKey) return { lcp: null, cls: null, inp: null }

  const url = `https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${encodeURIComponent(cruxApiKey)}`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ origin, formFactor: "PHONE" }),
    signal: AbortSignal.timeout(GOOGLE_REQUEST_TIMEOUT_MS),
  })

  recordApiCall("crux")
  if (!res.ok) return { lcp: null, cls: null, inp: null }

  const data = await res.json()
  const metrics = data.record?.metrics ?? {}

  function toMetric(m: { histogram?: { density: number }[] } | undefined): CwvMetric | null {
    if (!m?.histogram) return null
    return {
      good: Math.round((m.histogram[0]?.density ?? 0) * 100),
      needsImprovement: Math.round((m.histogram[1]?.density ?? 0) * 100),
      poor: Math.round((m.histogram[2]?.density ?? 0) * 100),
    }
  }

  return {
    lcp: toMetric(metrics.largest_contentful_paint),
    cls: toMetric(metrics.cumulative_layout_shift),
    inp: toMetric(metrics.interaction_to_next_paint),
  }
}

export async function discoverProperties(
  accessToken: string
): Promise<{ ga4Properties: { id: string; displayName: string }[]; gscSites: { siteUrl: string }[] }> {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })

  const adminClient = google.analyticsadmin({ version: "v1beta", auth })
  const webmastersClient = google.webmasters({ version: "v3", auth })

  const [accountsRes, sitesRes] = await Promise.all([
    adminClient.accounts.list({}, GOOGLE_REQUEST_OPTIONS),
    webmastersClient.sites.list({}, GOOGLE_REQUEST_OPTIONS),
  ])

  const ga4Properties: { id: string; displayName: string }[] = []
  for (const account of accountsRes.data.accounts ?? []) {
    const propsRes = await adminClient.properties.list(
      { filter: `parent:${account.name}` },
      GOOGLE_REQUEST_OPTIONS
    )
    for (const prop of propsRes.data.properties ?? []) {
      ga4Properties.push({ id: prop.name!, displayName: prop.displayName ?? prop.name! })
    }
  }

  const gscSites = (sitesRes.data.siteEntry ?? []).map((s) => ({ siteUrl: s.siteUrl! }))
  return { ga4Properties, gscSites }
}
