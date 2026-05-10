import { google } from "googleapis"
import type { AnalyticsReport, ChannelRow, PageRow, DailyRow } from "@/types/analytics"
import { recordApiCall } from "@/lib/db/queries/api-usage"

export async function fetchGA4Report(
  propertyId: string,
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<AnalyticsReport> {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth })

  const [overviewRes, channelsRes, pagesRes, dailyRes] = await Promise.all([
    analyticsdata.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        metrics: [
          { name: "sessions" },
          { name: "totalUsers" },
          { name: "screenPageViews" },
          { name: "bounceRate" },
          { name: "averageSessionDuration" },
        ],
        // Explicitly request the TOTAL aggregation. Without this, GA4 will
        // not populate `totals` in the response, AND the response body for a
        // no-dimensions query may also have rows[0] missing on some property
        // configurations. Asking for the total guarantees the metric values
        // arrive in `data.totals[0]`.
        metricAggregations: ["TOTAL"],
      },
    }),
    analyticsdata.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      },
    }),
    analyticsdata.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "sessions" }, { name: "screenPageViews" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        // Bumped from 20 → 200 so the Top Pages table can paginate. GA4
        // returns rows ordered by sessions DESC, so trailing entries are
        // your long-tail pages — useful for SEO content audits.
        limit: "200",
      },
    }),
    analyticsdata.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "date" }],
        metrics: [{ name: "sessions" }, { name: "totalUsers" }],
        orderBys: [{ dimension: { dimensionName: "date" } }],
      },
    }),
  ])

  // Four GA4 reports run concurrently above. Count them as four calls.
  recordApiCall("ga4")
  recordApiCall("ga4")
  recordApiCall("ga4")
  recordApiCall("ga4")

  // With `metricAggregations: ["TOTAL"]` (set in the request above), GA4
  // populates `data.totals[0].metricValues` reliably. Fall back to rows[0]
  // for forward compatibility / the existing test fixture shape.
  const overviewMetrics =
    overviewRes.data.totals?.[0]?.metricValues ??
    overviewRes.data.rows?.[0]?.metricValues ??
    []

  if (overviewMetrics.length === 0) {
    console.warn(
      "[GA4] overview metrics empty for property",
      propertyId,
      "— response keys:",
      Object.keys(overviewRes.data ?? {}),
      "rows:",
      overviewRes.data.rows?.length,
      "totals:",
      overviewRes.data.totals?.length
    )
  }

  const overview = {
    sessions: Number(overviewMetrics[0]?.value ?? 0),
    users: Number(overviewMetrics[1]?.value ?? 0),
    pageviews: Number(overviewMetrics[2]?.value ?? 0),
    bounceRate: Number(overviewMetrics[3]?.value ?? 0),
    avgSessionDuration: Number(overviewMetrics[4]?.value ?? 0),
  }

  const channels: ChannelRow[] = (channelsRes.data.rows ?? []).map((r) => ({
    channel: r.dimensionValues?.[0]?.value ?? "Unknown",
    sessions: Number(r.metricValues?.[0]?.value ?? 0),
  }))

  const topPages: PageRow[] = (pagesRes.data.rows ?? []).map((r) => ({
    pagePath: r.dimensionValues?.[0]?.value ?? "/",
    sessions: Number(r.metricValues?.[0]?.value ?? 0),
    pageviews: Number(r.metricValues?.[1]?.value ?? 0),
  }))

  const daily: DailyRow[] = (dailyRes.data.rows ?? []).map((r) => ({
    date: r.dimensionValues?.[0]?.value ?? "",
    sessions: Number(r.metricValues?.[0]?.value ?? 0),
    users: Number(r.metricValues?.[1]?.value ?? 0),
  }))

  return { overview, channels, topPages, daily }
}
