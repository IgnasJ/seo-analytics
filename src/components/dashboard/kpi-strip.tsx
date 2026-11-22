"use client"

import { Sparkline } from "./sparkline"
import { TrendChip } from "./trend-chip"
import { Hint } from "@/components/ui/hint"
import { formatCompact } from "@/lib/format"
import { useSearchParamSetter } from "@/hooks/use-search-param-setter"
import {
  HEALTH_PARAM,
  ISSUES_PARAM,
  type HealthFilter,
} from "@/lib/dashboard-params"

export interface KpiData {
  totalSessions: number
  /** Daily sessions rate: last 7 days vs the baseline period (see lib/seo/trend). */
  sessionsRecentRate: number | null
  sessionsBaselineRate: number | null
  dailySessions: number[]
  totalClicks: number
  clicksRecentRate: number | null
  clicksBaselineRate: number | null
  dailyClicks: number[]
  /** Impression-weighted average position across all domains. */
  avgPosition: number | null
  /** Same, for the last 7 days and for the baseline period. */
  avgPositionRecent: number | null
  avgPositionBaseline: number | null
  /** Health counts — scoped to every filter *except* the health one, so the
   *  pips keep showing what each of them would select. */
  healthy: number
  total: number
  amber: number
  red: number
}

interface Props {
  data: KpiData
  /** "the last 30 days" — the period the totals cover. */
  periodPhrase: string
  /** "30-day average" — what the trend chips compare the last week against. */
  baselinePhrase: string
  /** Health bucket currently selected via the pips, if any. */
  healthFilter: HealthFilter | null
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
export function KpiStrip({ data, periodPhrase, baselinePhrase, healthFilter }: Props) {
  const trendExplainer = (
    <div>
      The trend chip compares the <strong>daily average of the last 7 days</strong>{" "}
      against the <strong>{baselinePhrase}</strong>. Both are measured on days
      that actually have data, so reporting lag doesn&apos;t skew it.
    </div>
  )

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
              Sum of GA4 sessions across the domains shown below over{" "}
              {periodPhrase}.
            </div>
            {trendExplainer}
          </div>
        }
        value={formatNumber(data.totalSessions)}
        trend={
          <TrendChip
            current={data.sessionsRecentRate}
            previous={data.sessionsBaselineRate}
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
              Sum of Search Console clicks across the domains shown below over{" "}
              {periodPhrase}.
            </div>
            <div>
              These are visitors who clicked through from Google search
              results — a subset of total sessions.
            </div>
            {trendExplainer}
          </div>
        }
        value={formatNumber(data.totalClicks)}
        trend={
          <TrendChip
            current={data.clicksRecentRate}
            previous={data.clicksBaselineRate}
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
              Average Google search rank over {periodPhrase}, weighted by
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
                  the domains shown. <strong>Lower is better.</strong>
                </div>
                <div>
                  Compares your <strong>last 7 days</strong> against the{" "}
                  <strong>{baselinePhrase}</strong>. Green ↓ means your recent
                  week is ranking better than normal; red ↑ means it slipped.
                </div>
              </div>
            }
            className="cursor-help"
          >
            {/* current = recent 7d, previous = baseline period. Smaller
                "current" = improvement under lowerIsBetter. */}
            <TrendChip
              current={data.avgPositionRecent}
              previous={data.avgPositionBaseline}
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
              Click a coloured dot to show only the domains in that state;
              click it again to clear.
            </div>
          </div>
        }
        value={`${data.healthy}/${data.total}`}
        trend={<HealthBreakdown {...data} selected={healthFilter} />}
        spark={null}
      />
    </div>
  )
}

/**
 * Health breakdown — three coloured pips (green/amber/red) with counts, in the
 * same colour vocabulary as the per-card status dots. Each pip is a toggle that
 * narrows the dashboard to that bucket. Zero-count buckets render dimmed
 * instead of being hidden, so the layout stays consistent across reloads even
 * as health shifts.
 */
function HealthBreakdown({
  healthy,
  amber,
  red,
  selected,
}: {
  healthy: number
  amber: number
  red: number
  selected: HealthFilter | null
}) {
  const setParams = useSearchParamSetter()

  function toggle(bucket: HealthFilter) {
    // The pips refine what "Issues only" does coarsely, so picking one
    // replaces that toggle rather than stacking on top of it.
    setParams({
      [HEALTH_PARAM]: selected === bucket ? null : bucket,
      [ISSUES_PARAM]: null,
    })
  }

  return (
    <span className="inline-flex items-center gap-0.5">
      <HealthPip
        color="bg-green-500"
        label="healthy"
        count={healthy}
        active={selected === "green"}
        onClick={() => toggle("green")}
      />
      <HealthPip
        color="bg-amber-500"
        label="warning"
        count={amber}
        active={selected === "amber"}
        onClick={() => toggle("amber")}
      />
      <HealthPip
        color="bg-red-500"
        label="critical"
        count={red}
        active={selected === "red"}
        onClick={() => toggle("red")}
      />
    </span>
  )
}

function HealthPip({
  color,
  label,
  count,
  active,
  onClick,
}: {
  color: string
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  const dim = count === 0 && !active
  return (
    <Hint
      text={
        active
          ? `Showing ${label} domains only — click to clear`
          : `${count} ${label} — click to show only these`
      }
    >
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        aria-label={`${count} ${label} domains`}
        className={`inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-accent ${
          active ? "bg-accent ring-1 ring-border" : ""
        } ${dim ? "opacity-30" : ""}`}
      >
        <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
        <span className="text-xs font-medium tabular-nums">{count}</span>
      </button>
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
