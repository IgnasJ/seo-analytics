"use client"

import { Sparkline } from "./sparkline"
import { TrendChip } from "./trend-chip"
import { TrendingUp } from "lucide-react"
import { Hint } from "@/components/ui/hint"

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

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}K`
  return n.toLocaleString()
}

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
      className="hidden grid-cols-2 lg:grid-cols-4 gap-3 mb-6"
      data-slot="kpi-strip"
    >
      <KpiTile
        label="Total Sessions"
        value={formatNumber(data.totalSessions)}
        trend={
          <TrendChip
            current={data.totalSessions}
            previous={data.totalSessionsPrior}
            format="percent"
          />
        }
        spark={
          <Sparkline
            values={data.dailySessions}
            width={140}
            height={28}
            className="text-blue-500"
            ariaLabel="Total sessions trend"
          />
        }
      />
      <KpiTile
        label="Total Clicks"
        value={formatNumber(data.totalClicks)}
        trend={
          <TrendChip
            current={data.totalClicks}
            previous={data.totalClicksPrior}
            format="percent"
          />
        }
        spark={
          <Sparkline
            values={data.dailyClicks}
            width={140}
            height={28}
            className="text-emerald-500"
            ariaLabel="Total clicks trend"
          />
        }
      />
      <KpiTile
        label="Avg Position"
        value={data.avgPosition !== null ? data.avgPosition.toFixed(1) : "—"}
        trend={
          <Hint
            text={
              <div className="space-y-1">
                <div>
                  Average Google search rank, weighted by impressions across
                  all your domains.
                </div>
                <div>
                  <strong>Lower is better.</strong> Green ↓ means rank improved
                  (number decreased); red ↑ means rank slipped.
                </div>
                <div>30-day vs 7-day comparison.</div>
              </div>
            }
            className="cursor-help"
          >
            <TrendChip
              current={data.avgPosition}
              previous={data.avgPositionPrior}
              lowerIsBetter
              format="absolute"
              decimals={1}
            />
          </Hint>
        }
        spark={
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            impression-weighted
          </span>
        }
      />
      <KpiTile
        label="Healthy Domains"
        value={`${data.healthy} of ${data.total}`}
        trend={
          (data.amber + data.red) > 0 ? (
            <span className="text-xs text-muted-foreground">
              {data.red > 0 && `${data.red} critical`}
              {data.red > 0 && data.amber > 0 && ", "}
              {data.amber > 0 && `${data.amber} warn`}
            </span>
          ) : (
            <span className="text-xs text-green-600">all clear</span>
          )
        }
        spark={null}
      />
    </div>
  )
}

function KpiTile({
  label,
  value,
  trend,
  spark,
}: {
  label: string
  value: string
  trend: React.ReactNode
  spark: React.ReactNode
}) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="flex items-baseline justify-between gap-2 mt-1">
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <div className="shrink-0">{trend}</div>
      </div>
      <div className="mt-2 h-7 flex items-center">{spark}</div>
    </div>
  )
}
