import { getDb } from "@/lib/db"
import { listDomains } from "@/lib/db/queries/domains"
import { listCategories } from "@/lib/db/queries/categories"
import {
  getAnalyticsCache,
  getGscCache,
  getIssuesCache,
  getLastSyncedAt,
  getLastSyncStatus,
} from "@/lib/db/queries/cache"
import { DomainCard } from "@/components/domain-card"
import { Button } from "@/components/ui/button"
import { ViewToggle } from "@/components/dashboard/view-toggle"
import { KpiStrip, type KpiData } from "@/components/dashboard/kpi-strip"
import {
  cardHealth,
  healthCounts,
  type Severity,
} from "@/lib/seo/health"
import {
  sumDaily,
  weightedAvgPosition,
} from "@/lib/seo/aggregates"
import Link from "next/link"
import type { AnalyticsReport } from "@/types/analytics"
import type { GscReport, IssuesReport } from "@/types/search-console"

export const dynamic = "force-dynamic"

interface DashboardCard {
  id: number
  hostname: string
  category_id: number
  // Snapshots
  sessions: number | null
  clicks: number | null
  position1m: number | null
  position7d: number | null
  // Series
  dailySessions: number[]
  dailyClicks: number[]
  // Trend baseline (sums over the prior 7d for KPI strip)
  sessions7d: number
  clicks7d: number
  // Health signals
  ga4Linked: boolean
  gscLinked: boolean
  lastSyncedAt: number | null
  lastSyncStatus: "success" | "error" | null
  issueCount: number
  severity: Severity
}

export default function DashboardPage() {
  const db = getDb()
  const domains = listDomains(db)
  const categories = listCategories(db)

  const cards: DashboardCard[] = domains.map((domain) => {
    const analytics1m = getAnalyticsCache(db, domain.id, "1m") as AnalyticsReport | null
    const gsc1m = getGscCache(db, domain.id, "1m") as GscReport | null
    const gsc7d = getGscCache(db, domain.id, "7d") as GscReport | null
    const analytics7d = getAnalyticsCache(db, domain.id, "7d") as AnalyticsReport | null
    const issues = getIssuesCache(db, domain.id) as IssuesReport | null
    const lastSyncedAt = getLastSyncedAt(db, domain.id)
    const lastSyncStatus = getLastSyncStatus(db, domain.id)

    const issueCount =
      (issues?.sitemaps.reduce((s, sm) => s + sm.errors, 0) ?? 0) +
      (issues?.cwv.lcp?.poor ? 1 : 0) +
      (issues?.cwv.cls?.poor ? 1 : 0) +
      (issues?.cwv.inp?.poor ? 1 : 0)

    const ga4Linked = Boolean(domain.ga4_property_id)
    const gscLinked = Boolean(domain.gsc_site_url)

    const { severity } = cardHealth({
      ga4Linked,
      gscLinked,
      lastSyncedAt,
      lastSyncStatus,
      issueCount,
    })

    return {
      id: domain.id,
      hostname: domain.hostname,
      category_id: domain.category_id,
      sessions: analytics1m?.overview.sessions ?? null,
      clicks: gsc1m?.overview.totalClicks ?? null,
      position1m: gsc1m?.overview.avgPosition ?? null,
      position7d: gsc7d?.overview.avgPosition ?? null,
      dailySessions: (analytics1m?.daily ?? []).map((d) => d.sessions),
      dailyClicks: (gsc1m?.daily ?? []).map((d) => d.clicks),
      sessions7d: analytics7d?.overview.sessions ?? 0,
      clicks7d: gsc7d?.overview.totalClicks ?? 0,
      ga4Linked,
      gscLinked,
      lastSyncedAt,
      lastSyncStatus,
      issueCount,
      severity,
    }
  })

  // Group cards by category, preserving the categories' sort order. Empty
  // categories are filtered out.
  const grouped = categories
    .map((category) => ({
      category,
      cards: cards.filter((c) => c.category_id === category.id),
    }))
    .filter((g) => g.cards.length > 0)

  // KPI aggregates — fed into the (hidden by default) KpiStrip.
  const counts = healthCounts(cards.map((c) => c.severity))
  const kpi: KpiData = {
    totalSessions: cards.reduce((s, c) => s + (c.sessions ?? 0), 0),
    totalSessionsPrior: cards.reduce((s, c) => s + c.sessions7d, 0),
    dailySessions: sumDaily(cards.map((c) => c.dailySessions)),
    totalClicks: cards.reduce((s, c) => s + (c.clicks ?? 0), 0),
    totalClicksPrior: cards.reduce((s, c) => s + c.clicks7d, 0),
    dailyClicks: sumDaily(cards.map((c) => c.dailyClicks)),
    avgPosition: weightedAvgPosition(
      cards
        .filter((c) => c.position1m !== null)
        .map((c) => ({
          position: c.position1m!,
          impressions:
            (getGscCache(db, c.id, "1m") as GscReport | null)?.overview
              .totalImpressions ?? 0,
        }))
    ),
    avgPositionPrior: weightedAvgPosition(
      cards
        .filter((c) => c.position7d !== null)
        .map((c) => ({
          position: c.position7d!,
          impressions:
            (getGscCache(db, c.id, "7d") as GscReport | null)?.overview
              .totalImpressions ?? 0,
        }))
    ),
    healthy: counts.green,
    amber: counts.amber,
    red: counts.red,
    total: counts.total,
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <ViewToggle />
          <Link href="/domains">
            <Button variant="outline" size="sm">
              + Add Domain
            </Button>
          </Link>
        </div>
      </div>

      {cards.length > 0 && <KpiStrip data={kpi} />}

      {cards.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="mb-3">No domains yet.</p>
          <Link href="/domains">
            <Button size="sm">Add your first domain</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ category, cards }) => (
            <section key={category.id}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                {category.name}{" "}
                <span className="text-xs font-normal normal-case">
                  ({cards.length})
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {cards.map((card) => (
                  <DomainCard key={card.id} {...card} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
