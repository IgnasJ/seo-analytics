import { google } from "googleapis"
import type { GscReport, QueryRow, GscPageRow, DailyGscRow, PositionBuckets, IssuesReport, SitemapInfo, CwvMetric } from "@/types/search-console"

export async function fetchGSCReport(
  siteUrl: string,
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<GscReport> {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const webmasters = google.webmasters({ version: "v3", auth })

  const [queriesRes, pagesRes, dailyRes] = await Promise.all([
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
    }),
    webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ["page"],
        rowLimit: 500,
      },
    }),
    webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ["date"],
        rowLimit: 500,
      },
    }),
  ])

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

  const totalClicks = queryRows.reduce((s, r) => s + r.clicks, 0)
  const totalImpressions = queryRows.reduce((s, r) => s + r.impressions, 0)
  const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0
  const avgPosition =
    queryRows.length > 0
      ? queryRows.reduce((s, r) => s + r.position, 0) / queryRows.length
      : 0

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
  }
}

export async function fetchSitemaps(siteUrl: string, accessToken: string): Promise<SitemapInfo[]> {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const webmasters = google.webmasters({ version: "v3", auth })

  const res = await webmasters.sitemaps.list({ siteUrl })
  return (res.data.sitemap ?? []).map((s) => ({
    path: s.path ?? "",
    errors: s.errors ? Number(s.errors) : 0,
    warnings: s.warnings ? Number(s.warnings) : 0,
    indexed: s.contents?.[0]?.indexed ? Number(s.contents[0].indexed) : 0,
    submitted: s.contents?.[0]?.submitted ? Number(s.contents[0].submitted) : 0,
  }))
}

export async function fetchCrUX(origin: string, cruxApiKey: string): Promise<IssuesReport["cwv"]> {
  const url = `https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${cruxApiKey}`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ origin, formFactor: "PHONE" }),
  })

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
    adminClient.accounts.list({}),
    webmastersClient.sites.list(),
  ])

  const ga4Properties: { id: string; displayName: string }[] = []
  for (const account of accountsRes.data.accounts ?? []) {
    const propsRes = await adminClient.properties.list({ filter: `parent:${account.name}` })
    for (const prop of propsRes.data.properties ?? []) {
      ga4Properties.push({ id: prop.name!, displayName: prop.displayName ?? prop.name! })
    }
  }

  const gscSites = (sitesRes.data.siteEntry ?? []).map((s) => ({ siteUrl: s.siteUrl! }))
  return { ga4Properties, gscSites }
}
