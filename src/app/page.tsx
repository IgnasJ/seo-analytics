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
import { DomainCard } from "@/components/dashboard/domain-card"
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
import { Hint } from "@/components/ui/hint"
import { DashboardFilters } from "@/components/dashboard/filters"
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

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const rawCategory = Array.isArray(sp.category) ? sp.category[0] : sp.category
  const selectedCategoryId =
    rawCategory && /^\d+$/.test(rawCategory) ? Number(rawCategory) : null
  const issuesOnly = sp.issues === "1"

  const db = getDb()
  const domains = listDomains(db)
  const categories = listCategories(db)

  const allCards: DashboardCard[] = domains.map((domain) => {
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

  // Apply filters from URL search params. Both filters compose: e.g.
  // ?category=2&issues=1 = "show only domains in category 2 that have at
  // least one issue."
  const filteredCards = allCards.filter((c) => {
    if (selectedCategoryId !== null && c.category_id !== selectedCategoryId) {
      return false
    }
    if (issuesOnly && c.severity === "green") return false
    return true
  })

  // Per-category counts include only the issues-only filter, so flipping
  // categories via chips doesn't show 0s for visible options.
  const issuesScopedCards = issuesOnly
    ? allCards.filter((c) => c.severity !== "green")
    : allCards
  const categoryOptions = categories
    .map((c) => ({
      id: c.id,
      name: c.name,
      count: issuesScopedCards.filter((card) => card.category_id === c.id).length,
    }))
    // Hide categories with zero matches so the chip row stays compact.
    .filter((c) => c.count > 0)

  // Group filtered cards by category, preserving sort order. Empty
  // categories drop out of the rendered view.
  const grouped = categories
    .map((category) => ({
      category,
      cards: filteredCards.filter((c) => c.category_id === category.id),
    }))
    .filter((g) => g.cards.length > 0)

  // KPI aggregates use the FILTERED card set so the strip reflects exactly
  // what the user is currently looking at.
  const counts = healthCounts(filteredCards.map((c) => c.severity))
  const kpi: KpiData = {
    totalSessions: filteredCards.reduce((s, c) => s + (c.sessions ?? 0), 0),
    totalSessionsPrior: filteredCards.reduce((s, c) => s + c.sessions7d, 0),
    dailySessions: sumDaily(filteredCards.map((c) => c.dailySessions)),
    totalClicks: filteredCards.reduce((s, c) => s + (c.clicks ?? 0), 0),
    totalClicksPrior: filteredCards.reduce((s, c) => s + c.clicks7d, 0),
    dailyClicks: sumDaily(filteredCards.map((c) => c.dailyClicks)),
    avgPosition: weightedAvgPosition(
      filteredCards
        .filter((c) => c.position1m !== null)
        .map((c) => ({
          position: c.position1m!,
          impressions:
            (getGscCache(db, c.id, "1m") as GscReport | null)?.overview
              .totalImpressions ?? 0,
        }))
    ),
    avgPositionPrior: weightedAvgPosition(
      filteredCards
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
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
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

      {allCards.length > 0 && (
        <DashboardFilters
          categories={categoryOptions}
          selectedCategoryId={selectedCategoryId}
          issuesOnly={issuesOnly}
          filteredCount={filteredCards.length}
          totalCount={allCards.length}
        />
      )}

      {filteredCards.length > 0 && <KpiStrip data={kpi} />}

      {allCards.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="mb-3">No domains yet.</p>
          <Link href="/domains">
            <Button size="sm">Add your first domain</Button>
          </Link>
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No domains match the current filters.
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ category, cards }) => (
            <section key={category.id}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                <Hint
                  text={`Domains tagged "${category.name}". Manage categories on the Domains page.`}
                  className="cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-4"
                >
                  {category.name}
                </Hint>{" "}
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
