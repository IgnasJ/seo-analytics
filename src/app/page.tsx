import { getDb } from "@/lib/db"
import { listDomains } from "@/lib/db/queries/domains"
import { listCategories } from "@/lib/db/queries/categories"
import {
  getAnalyticsSummary,
  getGscSummary,
  getIssuesCache,
  getLatestSync,
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
import {
  classifyTrend,
  combineTrends,
  hasEnoughVolume,
  recentVsBaseline,
  sumComparisons,
  type RateComparison,
  type TrendDirection,
} from "@/lib/seo/trend"
import {
  DEFAULT_RANGE,
  isDashboardRangeKey,
  rangePhrase,
  type DashboardRangeKey,
} from "@/lib/date-range"
import { parseHealthFilter, parseTrendFilter } from "@/lib/dashboard-params"
import { Hint } from "@/components/ui/hint"
import { DashboardFilters } from "@/components/dashboard/filters"
import Link from "next/link"
import type { AnalyticsReport } from "@/types/analytics"
import type { GscReport, IssuesReport } from "@/types/search-console"

export const dynamic = "force-dynamic"

type AnalyticsSummary = Pick<AnalyticsReport, "overview"> & {
  daily?: AnalyticsReport["daily"]
}
type GscSummary = Partial<Pick<GscReport, "overview" | "daily">>

/**
 * What the trend chips compare the last 7 days against. It is the selected
 * period itself, except for the 7-day period — a week can't be its own
 * baseline, so that one is measured against the 30-day average.
 */
const BASELINE_RANGE: Record<DashboardRangeKey, DashboardRangeKey> = {
  "7d": "1m",
  "1m": "1m",
  "90d": "90d",
  "1y": "1y",
}

const BASELINE_PHRASE: Record<DashboardRangeKey, string> = {
  "7d": "7-day average",
  "1m": "30-day average",
  "90d": "90-day average",
  "1y": "12-month average",
}

interface DashboardCard {
  id: number
  hostname: string
  category_id: number
  // Snapshots for the selected period
  sessions: number | null
  clicks: number | null
  position: number | null
  // Position over the last 7 days and over the baseline period (trend chip)
  positionRecent: number | null
  positionBaseline: number | null
  // Series for the selected period
  dailySessions: number[]
  dailyClicks: number[]
  // Last-7-days pace vs the baseline pace, per metric, and the combined verdict
  sessionsTrend: RateComparison | null
  clicksTrend: RateComparison | null
  trend: TrendDirection | null
  // GSC impressions for the weighted-position KPI. Carried on the card so the
  // dashboard reads each domain's GSC cache once (during card build) instead of
  // re-reading + re-parsing it again while aggregating the KPI strip.
  impressions: number
  impressionsRecent: number
  impressionsBaseline: number
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

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/** Average position, or null when the report has no impressions behind it. */
function positionOf(gsc: GscSummary | null): number | null {
  const overview = gsc?.overview
  if (!overview || !(overview.totalImpressions > 0)) return null
  return overview.avgPosition
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const rawCategory = first(sp.category)
  const selectedCategoryId =
    rawCategory && /^\d+$/.test(rawCategory) ? Number(rawCategory) : null
  const issuesOnly = sp.issues === "1"
  const rawRange = first(sp.range)
  const range: DashboardRangeKey = isDashboardRangeKey(rawRange)
    ? rawRange
    : (DEFAULT_RANGE as DashboardRangeKey)
  const trendFilter = parseTrendFilter(first(sp.trend))
  const healthFilter = parseHealthFilter(first(sp.health))

  const baselineRange = BASELINE_RANGE[range]

  const db = getDb()
  const domains = listDomains(db)
  const categories = listCategories(db)

  const allCards: DashboardCard[] = domains.map((domain) => {
    // Summary readers return only overview + daily series: the cards never
    // touch the query / page tables, so there is no reason to JSON.parse them.
    // Each cache row is read at most once, whichever roles it plays.
    const analytics = getAnalyticsSummary(db, domain.id, range) as AnalyticsSummary | null
    const gsc = getGscSummary(db, domain.id, range) as GscSummary | null
    const analyticsBaseline =
      baselineRange === range
        ? analytics
        : (getAnalyticsSummary(db, domain.id, baselineRange) as AnalyticsSummary | null)
    const gscBaseline =
      baselineRange === range
        ? gsc
        : (getGscSummary(db, domain.id, baselineRange) as GscSummary | null)
    const gscRecent =
      range === "7d" ? gsc : (getGscSummary(db, domain.id, "7d") as GscSummary | null)
    const issues = getIssuesCache(db, domain.id) as IssuesReport | null
    const latestSync = getLatestSync(db, domain.id)
    const lastSyncedAt = latestSync?.syncedAt ?? null
    const lastSyncStatus = latestSync?.status ?? null

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

    // GA4 ranges end "today", so the newest GA4 row is a partial day — leave
    // it out of the pace comparison. Search Console rows are complete days.
    const sessionsTrend = recentVsBaseline(
      (analyticsBaseline?.daily ?? []).map((d) => ({ date: d.date, value: d.sessions })),
      { dropLastDay: true }
    )
    const clicksTrend = recentVsBaseline(
      (gscBaseline?.daily ?? []).map((d) => ({ date: d.date, value: d.clicks }))
    )

    return {
      id: domain.id,
      hostname: domain.hostname,
      category_id: domain.category_id,
      sessions: analytics?.overview?.sessions ?? null,
      clicks: gsc?.overview?.totalClicks ?? null,
      position: positionOf(gsc),
      positionRecent: positionOf(gscRecent),
      positionBaseline: positionOf(gscBaseline),
      dailySessions: (analytics?.daily ?? []).map((d) => d.sessions),
      dailyClicks: (gsc?.daily ?? []).map((d) => d.clicks),
      sessionsTrend,
      clicksTrend,
      trend: combineTrends([classifyTrend(sessionsTrend), classifyTrend(clicksTrend)]),
      impressions: gsc?.overview?.totalImpressions ?? 0,
      impressionsRecent: gscRecent?.overview?.totalImpressions ?? 0,
      impressionsBaseline: gscBaseline?.overview?.totalImpressions ?? 0,
      ga4Linked,
      gscLinked,
      lastSyncedAt,
      lastSyncStatus,
      issueCount,
      severity,
    }
  })

  // Filters from URL search params. They all compose: e.g.
  // ?category=2&trend=down = "declining domains in category 2".
  const inCategory = (c: DashboardCard) =>
    selectedCategoryId === null || c.category_id === selectedCategoryId
  const inHealth = (c: DashboardCard) =>
    (!issuesOnly || c.severity !== "green") &&
    (healthFilter === null || c.severity === healthFilter)
  const inTrend = (c: DashboardCard) => trendFilter === null || c.trend === trendFilter

  const filteredCards = allCards.filter(
    (c) => inCategory(c) && inHealth(c) && inTrend(c)
  )

  // Each filter control shows counts for what it *would* select, so its
  // counts are scoped by every filter except its own. Otherwise picking
  // "Declining" would zero out the "Growing" count, and so on.
  const categoryScope = allCards.filter((c) => inHealth(c) && inTrend(c))
  const trendScope = allCards.filter((c) => inCategory(c) && inHealth(c))
  const healthScope = allCards.filter((c) => inCategory(c) && inTrend(c))

  const categoryOptions = categories
    .map((c) => ({
      id: c.id,
      name: c.name,
      count: categoryScope.filter((card) => card.category_id === c.id).length,
    }))
    // Hide categories with zero matches so the chip row stays compact.
    .filter((c) => c.count > 0)

  const trendCounts = {
    down: trendScope.filter((c) => c.trend === "down").length,
    up: trendScope.filter((c) => c.trend === "up").length,
  }

  // Group filtered cards by category, preserving sort order. Empty
  // categories drop out of the rendered view.
  const grouped = categories
    .map((category) => ({
      category,
      cards: filteredCards.filter((c) => c.category_id === category.id),
    }))
    .filter((g) => g.cards.length > 0)

  // KPI aggregates use the FILTERED card set so the strip reflects exactly
  // what the user is currently looking at. The health tile is the exception:
  // its pips are filter controls, so it counts the health-agnostic scope.
  const counts = healthCounts(healthScope.map((c) => c.severity))
  // Summed over every card (small sites still contribute their share), but a
  // total that is itself tiny gets no trend chip.
  const shown = (pace: RateComparison | null) => (hasEnoughVolume(pace) ? pace : null)
  const sessionsPace = shown(sumComparisons(filteredCards.map((c) => c.sessionsTrend)))
  const clicksPace = shown(sumComparisons(filteredCards.map((c) => c.clicksTrend)))
  const weighted = (
    pick: (c: DashboardCard) => { position: number | null; impressions: number }
  ) =>
    weightedAvgPosition(
      filteredCards
        .map(pick)
        .filter((p): p is { position: number; impressions: number } => p.position !== null)
    )
  const kpi: KpiData = {
    totalSessions: filteredCards.reduce((s, c) => s + (c.sessions ?? 0), 0),
    sessionsRecentRate: sessionsPace?.recent ?? null,
    sessionsBaselineRate: sessionsPace?.baseline ?? null,
    dailySessions: sumDaily(filteredCards.map((c) => c.dailySessions)),
    totalClicks: filteredCards.reduce((s, c) => s + (c.clicks ?? 0), 0),
    clicksRecentRate: clicksPace?.recent ?? null,
    clicksBaselineRate: clicksPace?.baseline ?? null,
    dailyClicks: sumDaily(filteredCards.map((c) => c.dailyClicks)),
    avgPosition: weighted((c) => ({ position: c.position, impressions: c.impressions })),
    avgPositionRecent: weighted((c) => ({
      position: c.positionRecent,
      impressions: c.impressionsRecent,
    })),
    avgPositionBaseline: weighted((c) => ({
      position: c.positionBaseline,
      impressions: c.impressionsBaseline,
    })),
    healthy: counts.green,
    amber: counts.amber,
    red: counts.red,
    total: counts.total,
  }

  const periodPhrase = rangePhrase(range)
  const baselinePhrase = BASELINE_PHRASE[baselineRange]
  // Open a domain in the period the dashboard is showing.
  const detailQuery = range === DEFAULT_RANGE ? "" : `?range=${range}`

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
          range={range}
          trend={trendFilter}
          trendCounts={trendCounts}
          healthFilterActive={healthFilter !== null}
        />
      )}

      {/* Rendered whenever there are domains at all, even if the current
          filters match none: the health pips inside are how the user gets
          back out of a health filter. */}
      {allCards.length > 0 && (
        <KpiStrip
          data={kpi}
          periodPhrase={periodPhrase}
          baselinePhrase={baselinePhrase}
          healthFilter={healthFilter}
        />
      )}

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
                  <DomainCard
                    key={card.id}
                    id={card.id}
                    hostname={card.hostname}
                    href={`/domain/${card.id}${detailQuery}`}
                    periodPhrase={periodPhrase}
                    baselinePhrase={baselinePhrase}
                    dailySessions={card.dailySessions}
                    dailyClicks={card.dailyClicks}
                    sessions={card.sessions}
                    clicks={card.clicks}
                    sessionsTrend={shown(card.sessionsTrend)}
                    clicksTrend={shown(card.clicksTrend)}
                    position={card.position}
                    positionRecent={card.positionRecent}
                    positionBaseline={card.positionBaseline}
                    ga4Linked={card.ga4Linked}
                    gscLinked={card.gscLinked}
                    lastSyncedAt={card.lastSyncedAt}
                    lastSyncStatus={card.lastSyncStatus}
                    issueCount={card.issueCount}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
