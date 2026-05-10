import { google } from "googleapis"
import type {
  AnalyticsReport,
  ChannelRow,
  CountryRow,
  DailyRow,
  DeviceRow,
  PageRow,
} from "@/types/analytics"
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

  // Five concurrent reports:
  //   1. Daily breakdown over (date) with all 5 metrics + TOTAL aggregation —
  //      the TOTAL row replaces the previous separate dimension-less overview
  //      query, which GA4 was returning with empty metricValues for some
  //      property configurations. Adding the date dimension forces real rows
  //      to exist, so the TOTAL aggregation always populates.
  //   2. Channel breakdown.
  //   3. Top pages breakdown.
  //   4. Country breakdown — limit 25, ordered by sessions DESC.
  //   5. Device-category breakdown — desktop / mobile / tablet, max 3 rows.
  const [dailyRes, channelsRes, pagesRes, countriesRes, devicesRes] = await Promise.all([
    analyticsdata.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "date" }],
        metrics: [
          { name: "sessions" },
          { name: "totalUsers" },
          { name: "screenPageViews" },
          { name: "bounceRate" },
          { name: "averageSessionDuration" },
        ],
        orderBys: [{ dimension: { dimensionName: "date" } }],
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
        dimensions: [{ name: "country" }],
        metrics: [{ name: "sessions" }, { name: "totalUsers" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: "25",
      },
    }),
    analyticsdata.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "deviceCategory" }],
        metrics: [{ name: "sessions" }, { name: "totalUsers" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      },
    }),
  ])

  recordApiCall("ga4")
  recordApiCall("ga4")
  recordApiCall("ga4")
  recordApiCall("ga4")
  recordApiCall("ga4")

  // Overview metrics come from the TOTAL row of the daily query. Because the
  // request specifies a date dimension, GA4 always populates totals[0] when
  // there's any data in the range; we don't need the rows[0] fallback the
  // dimensionless overview required.
  const totalMetrics = dailyRes.data.totals?.[0]?.metricValues ?? []

  const overview = {
    sessions: Number(totalMetrics[0]?.value ?? 0),
    users: Number(totalMetrics[1]?.value ?? 0),
    pageviews: Number(totalMetrics[2]?.value ?? 0),
    bounceRate: Number(totalMetrics[3]?.value ?? 0),
    avgSessionDuration: Number(totalMetrics[4]?.value ?? 0),
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

  // Daily rows come from the same query — the chart only needs sessions and
  // users, so we drop the trailing 3 metrics here.
  const daily: DailyRow[] = (dailyRes.data.rows ?? []).map((r) => ({
    date: r.dimensionValues?.[0]?.value ?? "",
    sessions: Number(r.metricValues?.[0]?.value ?? 0),
    users: Number(r.metricValues?.[1]?.value ?? 0),
  }))

  const countries: CountryRow[] = (countriesRes.data.rows ?? []).map((r) => ({
    country: r.dimensionValues?.[0]?.value ?? "Unknown",
    sessions: Number(r.metricValues?.[0]?.value ?? 0),
    users: Number(r.metricValues?.[1]?.value ?? 0),
  }))

  const devices: DeviceRow[] = (devicesRes.data.rows ?? []).map((r) => ({
    device: r.dimensionValues?.[0]?.value ?? "unknown",
    sessions: Number(r.metricValues?.[0]?.value ?? 0),
    users: Number(r.metricValues?.[1]?.value ?? 0),
  }))

  return { overview, channels, topPages, daily, countries, devices }
}
