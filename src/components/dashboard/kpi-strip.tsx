"use client"

import { Sparkline } from "./sparkline"
import { TrendChip } from "./trend-chip"
import { Hint } from "@/components/ui/hint"
import { formatCompact } from "@/lib/format"

export interface KpiData {
  totalSessions: number
  totalSessionsPrior: number
  dailySessions: number[]
  totalClicks: number
  totalClicksPrior: number
  dailyClicks: number[]
  /** Impression-weighted average position across all domains. */
  avgPosition: number | null
  avgPositionPrior: number | null
  healthy: number
  total: number
  amber: number
  red: number
}

// Locale-stable across SSR and client. Server (Node) and browser locales
// often disagree on thousand separators, so always use the explicit
// "en-US"-grouped formatter exported from lib/format.
const formatNumber = (n: number) => formatCompact(n)

/**
 * Aggregate KPI strip rendered above the dashboard grid when the view toggle
 * is set to "Cards + KPI". Toggle controls visibility via a body data
 * attribute; this component just defaults to hidden and reveals when the
 * sibling selector matches.
 */
export function KpiStrip({ data }: { data: KpiData }) {
  return (
    <div
      // Visibility controlled via the body[data-kpi="on"] selector in
      // globals.css. Hidden by default so SSR doesn't flash the strip
      // before the toggle has hydrated.
      className="hidden grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-4"
      data-slot="kpi-strip"
    >
      <KpiTile
        label="Total Sessions"
        labelTooltip={
          <div className="space-y-1">
            <div>
              Sum of GA4 sessions across all your tracked domains over the
              last 30 days.
            </div>
            <div>
              The trend chip compares your <strong>recent 7-day daily
              average</strong> against your <strong>30-day daily average
              baseline</strong>. A green ↑ means traffic is up vs your
              normal pace.
            </div>
          </div>
        }
        value={formatNumber(data.totalSessions)}
        trend={
          // Recent rate vs baseline rate. Comparing totals directly
          // (1m vs 7d) is meaningless because 1m has 4× more days.
          <TrendChip
            current={data.totalSessionsPrior / 7}
            previous={data.totalSessions / 30}
            format="percent"
          />
        }
        spark={
          <Sparkline
            values={data.dailySessions}
            width={120}
            height={20}
            className="text-blue-500"
            ariaLabel="Total sessions trend"
          />
        }
      />
      <KpiTile
        label="Total Clicks"
        labelTooltip={
          <div className="space-y-1">
            <div>
              Sum of Search Console clicks across all your tracked domains
              over the last 30 days.
            </div>
            <div>
              These are visitors who clicked through from Google search
              results — a subset of total sessions.
            </div>
            <div>
              Trend chip compares <strong>recent 7-day daily average</strong>
              against the <strong>30-day daily average baseline</strong>.
            </div>
          </div>
        }
        value={formatNumber(data.totalClicks)}
        trend={
          <TrendChip
            current={data.totalClicksPrior / 7}
            previous={data.totalClicks / 30}
            format="percent"
          />
        }
        spark={
          <Sparkline
            values={data.dailyClicks}
            width={120}
            height={20}
            className="text-emerald-500"
            ariaLabel="Total clicks trend"
          />
        }
      />
      <KpiTile
        label="Avg Position"
        labelTooltip={
          <div className="space-y-1">
            <div>
              Average Google search rank across all your domains, weighted by
              impressions so high-traffic sites count more than tiny ones.
            </div>
            <div>
              Formula: <code>Σ(position × impressions) / Σ(impressions)</code>
              .
            </div>
          </div>
        }
        value={data.avgPosition !== null ? data.avgPosition.toFixed(1) : "—"}
        trend={
          <Hint
            text={
              <div className="space-y-1">
                <div>
                  Average Google search rank, weighted by impressions across
                  all your domains. <strong>Lower is better.</strong>
                </div>
                <div>
                  Compares your <strong>last 7 days</strong> against your{" "}
                  <strong>30-day baseline</strong>. Green ↓ means your recent
                  week is ranking better than normal; red ↑ means it slipped.
                </div>
              </div>
            }
            className="cursor-help"
          >
            {/* current = recent 7d, previous = 30d baseline. Smaller
                "current" = improvement under lowerIsBetter. */}
            <TrendChip
              current={data.avgPositionPrior}
              previous={data.avgPosition}
              lowerIsBetter
              format="absolute"
              decimals={1}
            />
          </Hint>
        }
        spark={null}
      />
      <KpiTile
        label="Healthy Domains"
        labelTooltip={
          <div className="space-y-1">
            <div>
              How many of your tracked domains are in good shape right now —
              all sources linked, recent successful sync, no active issues.
            </div>
            <div>
              The status dot on each card explains exactly why a domain is
              amber or red. Hover the dot to see.
            </div>
          </div>
        }
        value={`${data.healthy}/${data.total}`}
        trend={<HealthBreakdown {...data} />}
        spark={null}
      />
    </div>
  )
}

/**
 * Visual health breakdown — three colored pill indicators (green/amber/red)
 * with counts. Same colour vocabulary as the per-card status dots so the
 * KPI strip and the cards below it visually correspond. Zero-count buckets
 * render dimmed instead of being hidden, so the layout stays consistent
 * across reloads even as health shifts.
 */
function HealthBreakdown({
  healthy,
  amber,
  red,
}: {
  healthy: number
  amber: number
  red: number
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <HealthPip
        color="bg-green-500"
        label="healthy"
        count={healthy}
        ariaLabel={`${healthy} healthy domains`}
      />
      <HealthPip
        color="bg-amber-500"
        label="warning"
        count={amber}
        ariaLabel={`${amber} domains with warnings`}
      />
      <HealthPip
        color="bg-red-500"
        label="critical"
        count={red}
        ariaLabel={`${red} critical domains`}
      />
    </span>
  )
}

function HealthPip({
  color,
  label,
  count,
  ariaLabel,
}: {
  color: string
  label: string
  count: number
  ariaLabel: string
}) {
  const dim = count === 0
  return (
    <Hint text={count === 0 ? `0 ${label}` : `${count} ${label}`}>
      <span
        className={`inline-flex items-center gap-1 ${dim ? "opacity-30" : ""}`}
        aria-label={ariaLabel}
      >
        <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
        <span className="text-xs font-medium tabular-nums">{count}</span>
      </span>
    </Hint>
  )
}

function KpiTile({
  label,
  labelTooltip,
  value,
  trend,
  spark,
}: {
  label: string
  labelTooltip?: React.ReactNode
  value: string
  trend: React.ReactNode
  spark: React.ReactNode
}) {
  // Inline layout: label, value, trend, and (optional) sparkline all sit on
  // one row. Label is fixed-width small caps on the left; value + trend
  // group together; sparkline pushes itself to the far right via ml-auto.
  return (
    <div className="rounded-md border bg-card px-2.5 py-2 flex items-center gap-2 min-w-0">
      {labelTooltip ? (
        <Hint text={labelTooltip} className="inline-flex shrink-0">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2">
            {label}
          </span>
        </Hint>
      ) : (
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">
          {label}
        </span>
      )}
      <span className="text-base font-semibold tabular-nums leading-tight shrink-0">
        {value}
      </span>
      <span className="shrink-0">{trend}</span>
      {spark && <span className="ml-auto shrink-0">{spark}</span>}
    </div>
  )
}
