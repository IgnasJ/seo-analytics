import type { AnalyticsOverview } from "@/types/analytics"
import { formatInteger } from "@/lib/format"

interface Cell {
  label: string
  value: string
}

/**
 * Compact horizontal stat strip — replaces the previous 5-card grid that
 * each had its own border, header padding, and 2xl text. Now one
 * container with vertical dividers between cells; mobile collapses to a
 * 2-column grid.
 */
export function MetricsOverview({ data }: { data: AnalyticsOverview }) {
  const cells: Cell[] = [
    { label: "Sessions", value: formatInteger(data.sessions) },
    { label: "Users", value: formatInteger(data.users) },
    { label: "Pageviews", value: formatInteger(data.pageviews) },
    { label: "Bounce Rate", value: `${(data.bounceRate * 100).toFixed(1)}%` },
    {
      label: "Avg Duration",
      value: `${Math.round(data.avgSessionDuration)}s`,
    },
  ]

  return (
    <div className="rounded-md border bg-card grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x sm:divide-y-0 divide-y">
      {cells.map((c) => (
        <StatCell key={c.label} {...c} />
      ))}
    </div>
  )
}

function StatCell({ label, value }: Cell) {
  return (
    <div className="px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-lg font-semibold tabular-nums leading-tight mt-0.5">
        {value}
      </div>
    </div>
  )
}
