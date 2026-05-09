import { notFound } from "next/navigation"
import { getDb } from "@/lib/db"
import { getDomain } from "@/lib/db/queries/domains"
import { getAnalyticsCache, getGscCache, getIssuesCache, getLastSyncedAt } from "@/lib/db/queries/cache"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MetricsOverview } from "@/components/analytics/metrics-overview"
import { TrafficChart } from "@/components/analytics/traffic-chart"
import { ChannelChart } from "@/components/analytics/channel-chart"
import { TopPagesTable } from "@/components/analytics/top-pages-table"
import { GscOverview } from "@/components/search-console/gsc-overview"
import { GscChart } from "@/components/search-console/gsc-chart"
import { PositionBucketsChart } from "@/components/search-console/position-buckets"
import { TopQueriesTable } from "@/components/search-console/top-queries-table"
import { IssuesTab } from "@/components/issues/issues-tab"
import { OpportunitiesTab } from "@/components/opportunities/opportunities-tab"
import { SyncButton } from "@/components/sync-button"
import type { AnalyticsReport } from "@/types/analytics"
import type { GscReport, IssuesReport } from "@/types/search-console"
import { computeOpportunities } from "@/lib/seo/opportunities"

export const dynamic = "force-dynamic"

export default async function DomainPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const domain = getDomain(db, Number(id))
  if (!domain) notFound()

  const analytics = getAnalyticsCache(db, domain.id, "1m") as AnalyticsReport | null
  const gsc = getGscCache(db, domain.id, "1m") as GscReport | null
  const issues = getIssuesCache(db, domain.id) as IssuesReport | null
  const lastSyncedAt = getLastSyncedAt(db, domain.id)
  const opportunities = gsc ? computeOpportunities(gsc.topQueries) : []

  const syncAgo = lastSyncedAt ? Math.round((Date.now() / 1000 - lastSyncedAt) / 3600) : null

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">{domain.hostname}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {syncAgo !== null ? `Last synced ${syncAgo}h ago` : "Never synced"}
          </p>
        </div>
        <SyncButton domainId={domain.id} />
      </div>

      <Tabs defaultValue="analytics">
        <TabsList className="mb-4">
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="search-console">Search Console</TabsTrigger>
          <TabsTrigger value="issues">Issues</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="space-y-4">
          {analytics ? (
            <>
              <MetricsOverview data={analytics.overview} />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="lg:col-span-2">
                  <CardHeader><CardTitle className="text-sm">Sessions over time</CardTitle></CardHeader>
                  <CardContent><TrafficChart data={analytics.daily} /></CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-sm">Traffic by channel</CardTitle></CardHeader>
                  <CardContent><ChannelChart data={analytics.channels} /></CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader><CardTitle className="text-sm">Top pages</CardTitle></CardHeader>
                <CardContent><TopPagesTable data={analytics.topPages} /></CardContent>
              </Card>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">No analytics data. Sync to load.</p>
          )}
        </TabsContent>

        <TabsContent value="search-console" className="space-y-4">
          {gsc ? (
            <>
              <GscOverview data={gsc.overview} />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="lg:col-span-2">
                  <CardHeader><CardTitle className="text-sm">Clicks &amp; Impressions</CardTitle></CardHeader>
                  <CardContent><GscChart data={gsc.daily} /></CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-sm">Keyword positions</CardTitle></CardHeader>
                  <CardContent><PositionBucketsChart data={gsc.positionBuckets} /></CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader><CardTitle className="text-sm">Top queries</CardTitle></CardHeader>
                <CardContent><TopQueriesTable data={gsc.topQueries} /></CardContent>
              </Card>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">No Search Console data. Sync to load.</p>
          )}
        </TabsContent>

        <TabsContent value="issues">
          <IssuesTab data={issues} />
        </TabsContent>

        <TabsContent value="opportunities">
          <OpportunitiesTab data={opportunities} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
