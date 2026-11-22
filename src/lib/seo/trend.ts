// "Is the last week above or below the normal pace?" — the maths behind the
// dashboard trend chips and the Declining / Growing filter. Pure functions.
//
// Everything works on the cached *daily series* and real calendar dates rather
// than on period totals divided by a nominal day count. The nominal approach
// (7-day total / 7 vs 30-day total / 30) is biased whenever a window isn't
// fully populated, which is always the case for Search Console: its data lags
// by several days, so a "7 day" window holds ~4 days of clicks and the old
// comparison showed a ~35% drop for perfectly flat traffic.

export interface DailyPoint {
  /** "YYYY-MM-DD" (Search Console) or "YYYYMMDD" (GA4). */
  date: string
  value: number
}

export interface RateComparison {
  /** Average per day over the most recent `recentDays` days with data. */
  recent: number
  /** Average per day over the whole series span. */
  baseline: number
}

const MS_PER_DAY = 86_400_000

/** Days since the Unix epoch for a calendar date, or null if unparseable. */
export function dayNumber(date: string): number | null {
  const m = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(date)
  if (!m) return null
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isFinite(ms) ? Math.round(ms / MS_PER_DAY) : null
}

export interface RecentVsBaselineOptions {
  /** Length of the "recent" window in days. Default 7. */
  recentDays?: number
  /**
   * Ignore the newest day in the series. GA4 ranges end "today", so their last
   * row is a partial day that would drag the recent average down.
   */
  dropLastDay?: boolean
}

/**
 * Compare the daily average of the last `recentDays` days of a series with the
 * daily average of the whole series.
 *
 * Days missing from the series count as zero (the APIs omit empty days), and
 * the windows are anchored on the newest date that actually has data, so
 * reporting lag doesn't distort the comparison.
 *
 * Returns null when the series is too short to say anything — it must span
 * more days than the recent window itself.
 */
export function recentVsBaseline(
  points: DailyPoint[],
  options: RecentVsBaselineOptions = {}
): RateComparison | null {
  const recentDays = options.recentDays ?? 7

  let days: { day: number; value: number }[] = []
  for (const p of points) {
    const day = dayNumber(p.date)
    if (day === null || !Number.isFinite(p.value)) continue
    days.push({ day, value: p.value })
  }
  if (days.length === 0) return null

  let last = days.reduce((max, d) => Math.max(max, d.day), -Infinity)
  if (options.dropLastDay) {
    days = days.filter((d) => d.day !== last)
    if (days.length === 0) return null
    last = days.reduce((max, d) => Math.max(max, d.day), -Infinity)
  }
  const first = days.reduce((min, d) => Math.min(min, d.day), Infinity)

  const span = last - first + 1
  if (span <= recentDays) return null

  let total = 0
  let recentTotal = 0
  const recentStart = last - recentDays + 1
  for (const d of days) {
    total += d.value
    if (d.day >= recentStart) recentTotal += d.value
  }

  return { recent: recentTotal / recentDays, baseline: total / span }
}

export type TrendDirection = "up" | "down" | "flat"

export interface ClassifyOptions {
  /** Minimum move, in percent of the baseline, to count as up / down. Default 10. */
  thresholdPct?: number
  /**
   * Minimum events per week (on either side of the comparison) before a
   * direction is reported. Below this a site's numbers are too small for a
   * percentage to mean anything — 2 visits becoming 1 is not a "50% drop".
   * Default 10.
   */
  minWeeklyVolume?: number
}

const DEFAULT_MIN_WEEKLY_VOLUME = 10

/**
 * True when a comparison has enough traffic behind it for a percentage to be
 * worth showing. Used both to classify and to decide whether a trend chip is
 * rendered at all — "2 clicks ↑157%" is noise, not information.
 */
export function hasEnoughVolume(
  comparison: RateComparison | null,
  minWeeklyVolume: number = DEFAULT_MIN_WEEKLY_VOLUME
): comparison is RateComparison {
  if (!comparison) return false
  return Math.max(comparison.recent, comparison.baseline) * 7 >= minWeeklyVolume
}

/**
 * Turn a rate comparison into a direction, or null when there is no
 * comparison or too little volume to judge.
 */
export function classifyTrend(
  comparison: RateComparison | null,
  options: ClassifyOptions = {}
): TrendDirection | null {
  const thresholdPct = options.thresholdPct ?? 10
  if (!hasEnoughVolume(comparison, options.minWeeklyVolume)) return null
  const { recent, baseline } = comparison

  if (baseline === 0) return recent > 0 ? "up" : "flat"

  const pct = ((recent - baseline) / baseline) * 100
  if (pct <= -thresholdPct) return "down"
  if (pct >= thresholdPct) return "up"
  return "flat"
}

/**
 * One direction for a domain from its individual metric directions.
 *
 * A drop in *any* metric makes the domain "down": the filter exists to surface
 * sites that need a look, and sessions rising doesn't make falling search
 * clicks less worth knowing about. "up" therefore means something grew and
 * nothing fell. Null when no metric could be judged.
 */
export function combineTrends(
  directions: (TrendDirection | null)[]
): TrendDirection | null {
  const known = directions.filter((d): d is TrendDirection => d !== null)
  if (known.length === 0) return null
  if (known.includes("down")) return "down"
  if (known.includes("up")) return "up"
  return "flat"
}

/**
 * Portfolio-level comparison: per-domain daily rates add up, so the summed
 * recent rate against the summed baseline rate is the trend of the total.
 * Domains without a comparison are left out of both sides.
 */
export function sumComparisons(
  comparisons: (RateComparison | null)[]
): RateComparison | null {
  let recent = 0
  let baseline = 0
  let any = false
  for (const c of comparisons) {
    if (!c) continue
    any = true
    recent += c.recent
    baseline += c.baseline
  }
  return any ? { recent, baseline } : null
}
