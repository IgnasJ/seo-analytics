"use client"

import dynamic from "next/dynamic"

/**
 * Lazy, client-only wrappers for the recharts-backed URL trend charts.
 *
 * recharts is a large dependency and these charts live inside the collapsed
 * "Audit history" section of `/audit/url`, below the fold. Loading them with
 * `ssr: false` keeps recharts out of the route's server render (CPU) and off
 * the initial hydration critical path — the chart chunk streams in on the
 * client and swaps in over the skeleton, with no visible layout shift.
 */
const ChartSkeleton = () => (
  <div className="h-[240px] w-full animate-pulse rounded-md bg-muted/40" />
)

export const UrlScoreChartLazy = dynamic(
  () => import("./url-score-chart").then((m) => m.UrlScoreChart),
  { ssr: false, loading: ChartSkeleton }
)

export const UrlCwvChartLazy = dynamic(
  () => import("./url-cwv-chart").then((m) => m.UrlCwvChart),
  { ssr: false, loading: ChartSkeleton }
)
