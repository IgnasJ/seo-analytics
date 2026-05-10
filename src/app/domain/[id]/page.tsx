import { notFound } from "next/navigation"
import { getDb } from "@/lib/db"
import { getDomain } from "@/lib/db/queries/domains"
import {
  getAnalyticsCache,
  getGscCache,
  getIssuesCache,
  getLastSyncedAt,
} from "@/lib/db/queries/cache"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MetricsOverview } from "@/components/analytics/metrics-overview"
import { TrafficChart } from "@/components/analytics/traffic-chart"
import { ChannelChart } from "@/components/analytics/channel-chart"
import { TopPagesTable } from "@/components/analytics/top-pages-table"
import { CountryChart } from "@/components/analytics/country-chart"
import { DeviceChart } from "@/components/analytics/device-chart"
import { GscOverview } from "@/components/search-console/gsc-overview"
import { GscChart } from "@/components/search-console/gsc-chart"
import { PositionBucketsChart } from "@/components/search-console/position-buckets"
import { TopQueriesTable } from "@/components/search-console/top-queries-table"
import { IssuesTab } from "@/components/issues/issues-tab"
import { OpportunitiesTab } from "@/components/opportunities/opportunities-tab"
import { DomainAuditsTab } from "@/components/domain/domain-audits-tab"
import { SyncButton } from "@/components/sync/sync-button"
import { DateRangePickerLink } from "@/components/date-range-picker"
import {
  DEFAULT_RANGE,
  isDateRangeKey,
  type DateRangeKey,
} from "@/lib/date-range"
import type { AnalyticsReport } from "@/types/analytics"
import type { GscReport, IssuesReport } from "@/types/search-console"
import { computeOpportunities } from "@/lib/seo/opportunities"
import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs"

export const dynamic = "force-dynamic"

const RANGE_LABEL: Record<DateRangeKey, string> = {
  today: "today",
  yesterday: "yesterday",
  "7d": "the last 7 days",
  "1m": "the last 30 days",
  "90d": "the last 90 days",
  "1y": "the last year",
}

export default async function DomainPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const sp = await searchParams
  const rawRange = Array.isArray(sp.range) ? sp.range[0] : sp.range
  const range: DateRangeKey = isDateRangeKey(rawRange) ? rawRange : DEFAULT_RANGE

  const db = getDb()
  const domain = getDomain(db, Number(id))
  if (!domain) notFound()

  const analytics = getAnalyticsCache(db, domain.id, range) as AnalyticsReport | null
  const gsc = getGscCache(db, domain.id, range) as GscReport | null
  const issues = getIssuesCache(db, domain.id) as IssuesReport | null
  const lastSyncedAt = getLastSyncedAt(db, domain.id)
  const opportunities = gsc ? computeOpportunities(gsc.topQueries) : []

  const syncAgo = lastSyncedAt
    ? Math.round((Date.now() / 1000 - lastSyncedAt) / 3600)
    : null

  return (
    <div>
      <PageBreadcrumbs
        items={[
          { label: "Dashboard", href: "/" },
          { label: domain.hostname },
        ]}
      />
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-semibold">{domain.hostname}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {syncAgo !== null ? `Last synced ${syncAgo}h ago` : "Never synced"}
          </p>
        </div>
        <SyncButton domainId={domain.id} />
      </div>

      <Tabs defaultValue="analytics">
        {/* Tabs row scrolls horizontally on viewports too narrow to fit
            them all. Faded mask on the right edge hints at hidden tabs.
            -mx negative margin lets the scroll area extend to the page
            edge on mobile so the last tab isn't visually cropped. */}
        <div className="-mx-3 sm:-mx-4 md:mx-0 px-3 sm:px-4 md:px-0 mb-4 overflow-x-auto scrollbar-thin">
          <TabsList className="inline-flex w-max min-w-full">
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="search-console">Search Console</TabsTrigger>
            <TabsTrigger value="issues">Issues</TabsTrigger>
            <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
            <TabsTrigger value="audits">Audits</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="analytics" className="space-y-3">
          <RangeBar range={range} />
          {analytics ? (
            <>
              <MetricsOverview data={analytics.overview} />
              {/* Sessions-over-time gets the full width of the tab so the
                  daily trend has room to breathe. */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Sessions over time</CardTitle>
                </CardHeader>
                <CardContent>
                  <TrafficChart data={analytics.daily} />
                </CardContent>
              </Card>
              {/* Three breakdowns share one row on lg+, stack on mobile. */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Traffic by channel</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChannelChart data={analytics.channels} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Top countries</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CountryChart data={analytics.countries ?? []} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Devices</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DeviceChart data={analytics.devices ?? []} />
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Top pages</CardTitle>
                </CardHeader>
                <CardContent>
                  <TopPagesTable data={analytics.topPages} />
                </CardContent>
              </Card>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              No analytics data for this range yet. Click <strong>Sync</strong>{" "}
              to fetch fresh data — it pulls every range in one pass.
            </p>
          )}
        </TabsContent>

        <TabsContent value="search-console" className="space-y-3">
          <RangeBar range={range} />
          {gsc ? (
            <>
              <GscOverview data={gsc.overview} />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-sm">
                      Clicks &amp; Impressions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <GscChart data={gsc.daily} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Keyword positions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PositionBucketsChart data={gsc.positionBuckets} />
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Top queries</CardTitle>
                </CardHeader>
                <CardContent>
                  <TopQueriesTable data={gsc.topQueries} />
                </CardContent>
              </Card>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              No Search Console data for this range yet. Click{" "}
              <strong>Sync</strong> to fetch fresh data.
            </p>
          )}
        </TabsContent>

        <TabsContent value="issues">
          <IssuesTab data={issues} />
        </TabsContent>

        <TabsContent value="opportunities">
          <OpportunitiesTab data={opportunities} />
        </TabsContent>

        <TabsContent value="audits">
          <DomainAuditsTab
            domainId={domain.id}
            hostname={domain.hostname}
            hasGscTopPages={(gsc?.topPages?.length ?? 0) > 0}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/**
 * Date-range picker plus a small "showing the last 30 days" caption.
 * Rendered only inside tabs whose data is range-bound (Analytics, Search
 * Console). The Issues and Opportunities tabs use range-independent data
 * (CrUX field metrics, sitemap status) or a fixed lookback, so the picker
 * doesn't belong there.
 */
function RangeBar({ range }: { range: DateRangeKey }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-1">
      <DateRangePickerLink selected={range} />
      <span className="text-xs text-muted-foreground">
        showing {RANGE_LABEL[range]}
      </span>
    </div>
  )
}
