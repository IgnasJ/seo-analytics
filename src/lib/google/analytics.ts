import { google } from "googleapis"
import type { AnalyticsReport, ChannelRow, PageRow, DailyRow } from "@/types/analytics"

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
        limit: 20,
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

  const totals = overviewRes.data.totals?.[0]?.metricValues ?? []

  const overview = {
    sessions: Number(totals[0]?.value ?? 0),
    users: Number(totals[1]?.value ?? 0),
    pageviews: Number(totals[2]?.value ?? 0),
    bounceRate: Number(totals[3]?.value ?? 0),
    avgSessionDuration: Number(totals[4]?.value ?? 0),
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
