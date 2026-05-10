import Link from "next/link"
import { getDb } from "@/lib/db"
import { listDomains } from "@/lib/db/queries/domains"
import { listCategories } from "@/lib/db/queries/categories"
import {
  getAnalyticsCache,
  getGscCache,
  getLastSyncedAt,
  getLastSyncStatus,
} from "@/lib/db/queries/cache"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Hint } from "@/components/ui/hint"
import { DateRangePickerLink } from "@/components/date-range-picker"
import {
  DEFAULT_RANGE,
  isDateRangeKey,
  type DateRangeKey,
} from "@/lib/date-range"
import { DashboardFilters } from "@/components/dashboard/filters"
import { PageBreadcrumbs } from "@/components/page-breadcrumbs"
import { MultiDomainLineChart, type DomainSeries } from "@/components/analytics/multi-domain-line-chart"
import { LeaderboardTable, type LeaderboardRow } from "@/components/analytics/leaderboard-table"
import { ShareBarChart, type ShareRow } from "@/components/analytics/share-bar-chart"
import { cardHealth } from "@/lib/seo/health"
import type { AnalyticsReport } from "@/types/analytics"
import type { GscReport } from "@/types/search-console"

export const dynamic = "force-dynamic"

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AnalyticsPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const rawRange = Array.isArray(sp.range) ? sp.range[0] : sp.range
  const range: DateRangeKey = isDateRangeKey(rawRange) ? rawRange : DEFAULT_RANGE
  const rawCategory = Array.isArray(sp.category) ? sp.category[0] : sp.category
  const selectedCategoryId =
    rawCategory && /^\d+$/.test(rawCategory) ? Number(rawCategory) : null
  const issuesOnly = sp.issues === "1"

  // Per-domain exclusion is a comma-separated list of domain ids in
  // ?exclude=… — toggled via the leaderboard's eye column. Excluded
  // domains drop from the trend charts and breakdowns but stay (dimmed)
  // in the leaderboard so they're easy to re-include.
  const rawExclude = Array.isArray(sp.exclude) ? sp.exclude[0] : sp.exclude
  const excludedIds = parseExcludeList(rawExclude)

  const db = getDb()
  const allDomains = listDomains(db)
  const allCategories = listCategories(db)
  const categoryName = (id: number) =>
    allCategories.find((c) => c.id === id)?.name ?? "Uncategorized"

  // Build a fully-loaded row per domain. We pull both 1m and the selected
  // range — the 1m range powers the leaderboard's headline numbers (it's
  // what the dashboard shows so the two pages agree); the selected range
  // powers the trend charts (date span the user explicitly picked).
  type Loaded = {
    domain: (typeof allDomains)[number]
    selectedAnalytics: AnalyticsReport | null
    selectedGsc: GscReport | null
    headlineAnalytics: AnalyticsReport | null
    headlineGsc: GscReport | null
    lastSyncedAt: number | null
    lastSyncStatus: "success" | "error" | null
  }
  const loaded: Loaded[] = allDomains.map((d) => ({
    domain: d,
    selectedAnalytics: getAnalyticsCache(db, d.id, range) as AnalyticsReport | null,
    selectedGsc: getGscCache(db, d.id, range) as GscReport | null,
    headlineAnalytics: getAnalyticsCache(db, d.id, "1m") as AnalyticsReport | null,
    headlineGsc: getGscCache(db, d.id, "1m") as GscReport | null,
    lastSyncedAt: getLastSyncedAt(db, d.id),
    lastSyncStatus: getLastSyncStatus(db, d.id),
  }))

  // Severity per domain, used both for the leaderboard's status column and
  // for the optional issues-only filter.
  const withSeverity = loaded.map((row) => {
    const issues = 0 // issue count not in this query path; severity is derived
    // from the same signals as the dashboard cards.
    const { severity, reasons } = cardHealth({
      ga4Linked: Boolean(row.domain.ga4_property_id),
      gscLinked: Boolean(row.domain.gsc_site_url),
      lastSyncedAt: row.lastSyncedAt,
      lastSyncStatus: row.lastSyncStatus,
      issueCount: issues,
    })
    return { ...row, severity, reasons }
  })

  // Apply category + issues-only filters before computing everything else.
  const filtered = withSeverity.filter((row) => {
    if (selectedCategoryId !== null && row.domain.category_id !== selectedCategoryId) {
      return false
    }
    if (issuesOnly && row.severity === "green") return false
    return true
  })

  // For trends + breakdowns, also drop the explicitly-excluded domains.
  // The leaderboard sees `filtered` (full set) so excluded rows can be
  // re-included with one click; the comparison sections see `forCharts`.
  const excludedSet = new Set(excludedIds)
  const forCharts = filtered.filter((r) => !excludedSet.has(r.domain.id))

  // Per-category counts honour the issues-only filter so chip counts don't
  // lie when the user toggles issues.
  const issuesScoped = issuesOnly
    ? withSeverity.filter((r) => r.severity !== "green")
    : withSeverity
  const categoryOptions = allCategories
    .map((c) => ({
      id: c.id,
      name: c.name,
      count: issuesScoped.filter((r) => r.domain.category_id === c.id).length,
    }))
    .filter((c) => c.count > 0)

  // ---- Trend series (uses forCharts: post-exclusion set) ----
  const dateUnion = (key: "analytics" | "gsc"): string[] => {
    const seen = new Set<string>()
    for (const r of forCharts) {
      const series =
        key === "analytics"
          ? r.selectedAnalytics?.daily ?? []
          : r.selectedGsc?.daily ?? []
      for (const d of series) seen.add(d.date)
    }
    return Array.from(seen).sort()
  }

  const sessionsDates = dateUnion("analytics")
  const clicksDates = dateUnion("gsc")

  const sessionsSeries: DomainSeries[] = forCharts.map((r) => ({
    domainId: r.domain.id,
    hostname: r.domain.hostname,
    data: (r.selectedAnalytics?.daily ?? []).map((d) => ({
      date: d.date,
      value: d.sessions,
    })),
  }))

  const clicksSeries: DomainSeries[] = forCharts.map((r) => ({
    domainId: r.domain.id,
    hostname: r.domain.hostname,
    data: (r.selectedGsc?.daily ?? []).map((d) => ({
      date: d.date,
      value: d.clicks,
    })),
  }))

  const impressionsSeries: DomainSeries[] = forCharts.map((r) => ({
    domainId: r.domain.id,
    hostname: r.domain.hostname,
    data: (r.selectedGsc?.daily ?? []).map((d) => ({
      date: d.date,
      value: d.impressions,
    })),
  }))

  // ---- Leaderboard rows ----
  const leaderboardRows: LeaderboardRow[] = filtered.map((r) => ({
    domainId: r.domain.id,
    hostname: r.domain.hostname,
    categoryName: categoryName(r.domain.category_id),
    sessions: r.headlineAnalytics?.overview.sessions ?? 0,
    bounceRate: r.headlineAnalytics?.overview.bounceRate ?? 0,
    clicks: r.headlineGsc?.overview.totalClicks ?? 0,
    ctr: r.headlineGsc?.overview.avgCtr ?? 0,
    position: r.headlineGsc?.overview.avgPosition ?? null,
    severity: r.severity,
    reasons: r.reasons,
  }))

  // ---- Breakdown rows (uses forCharts: post-exclusion set) ----
  const channelsRows: ShareRow[] = forCharts.map((r) => ({
    label: r.domain.hostname,
    segments: (r.headlineAnalytics?.channels ?? []).map((c) => ({
      name: c.channel,
      value: c.sessions,
    })),
  }))

  const countriesRows: ShareRow[] = forCharts.map((r) => ({
    label: r.domain.hostname,
    segments: (r.headlineAnalytics?.countries ?? []).map((c) => ({
      name: c.country,
      value: c.sessions,
    })),
  }))

  const devicesRows: ShareRow[] = forCharts.map((r) => ({
    label: r.domain.hostname,
    segments: (r.headlineAnalytics?.devices ?? []).map((d) => ({
      name: d.device,
      value: d.sessions,
    })),
  }))

  return (
    <div>
      <PageBreadcrumbs
        items={[{ label: "Dashboard", href: "/" }, { label: "Analytics" }]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-xl font-semibold">Analytics</h1>
        <DateRangePickerLink selected={range} />
      </div>

      {allDomains.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="mb-3">No domains yet.</p>
          <Link href="/domains">
            <Button size="sm">Add your first domain</Button>
          </Link>
        </div>
      ) : (
        <>
          <DashboardFilters
            categories={categoryOptions}
            selectedCategoryId={selectedCategoryId}
            issuesOnly={issuesOnly}
            filteredCount={filtered.length}
            totalCount={allDomains.length}
          />

          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No domains match the current filters.
            </div>
          ) : (
            <div className="space-y-8">
              {/* TRENDS */}
              <section id="trends" className="space-y-4 scroll-mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">
                      <Hint
                        text="Daily total sessions across all domains in the selected window. One line per domain — click a domain in the legend to mute its line. Y-axis is absolute; the largest domain may dwarf smaller ones."
                        className="cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2"
                      >
                        Sessions
                      </Hint>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MultiDomainLineChart
                      series={sessionsSeries}
                      dateKeys={sessionsDates}
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">
                      <Hint
                        text="Daily Search Console clicks per domain. The downstream metric — clicks come from impressions × CTR. If clicks drop but impressions don't, your CTR slipped."
                        className="cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2"
                      >
                        Clicks
                      </Hint>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MultiDomainLineChart
                      series={clicksSeries}
                      dateKeys={clicksDates}
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">
                      <Hint
                        text="Daily Search Console impressions per domain. Search-visibility leading indicator — if impressions tank, clicks usually follow next week."
                        className="cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2"
                      >
                        Impressions
                      </Hint>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MultiDomainLineChart
                      series={impressionsSeries}
                      dateKeys={clicksDates}
                    />
                  </CardContent>
                </Card>
              </section>

              {/* LEADERBOARD */}
              <section id="leaderboard" className="scroll-mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Leaderboard</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Headline numbers across all visible domains. Click any
                      column header to sort.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <LeaderboardTable
                      rows={leaderboardRows}
                      excludedIds={excludedIds}
                    />
                  </CardContent>
                </Card>
              </section>

              {/* BREAKDOWNS */}
              <section id="breakdowns" className="space-y-4 scroll-mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">
                      <Hint
                        text="Each domain's traffic mix by GA4 default channel. Width = share of that domain's total sessions, not absolute volume — comparable across small and large sites."
                        className="cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2"
                      >
                        Channels by share
                      </Hint>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ShareBarChart rows={channelsRows} topN={6} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Countries by share</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ShareBarChart rows={countriesRows} topN={5} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Devices</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ShareBarChart
                      rows={devicesRows}
                      topN={Number.POSITIVE_INFINITY}
                      segmentOrder={["desktop", "mobile", "tablet"]}
                    />
                  </CardContent>
                </Card>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Parse `?exclude=1,3,7` into a deduped, sorted list of positive integers.
 * Garbage entries are ignored silently — the URL is user-editable so we
 * shouldn't crash on a typo.
 */
function parseExcludeList(raw: string | undefined): number[] {
  if (!raw) return []
  const seen = new Set<number>()
  for (const part of raw.split(",")) {
    if (!/^\d+$/.test(part)) continue
    const n = Number(part)
    if (Number.isFinite(n) && n > 0) seen.add(n)
  }
  return [...seen].sort((a, b) => a - b)
}
