import type { GscOverview } from "@/types/search-console"
import { formatInteger } from "@/lib/format"

interface Cell {
  label: string
  value: string
}

/**
 * Compact horizontal stat strip — same layout as MetricsOverview on the
 * Analytics tab. One container, divided cells, smaller chrome than the
 * previous 4-card grid.
 */
export function GscOverview({ data }: { data: GscOverview }) {
  const cells: Cell[] = [
    { label: "Total Clicks", value: formatInteger(data.totalClicks) },
    { label: "Impressions", value: formatInteger(data.totalImpressions) },
    { label: "Avg CTR", value: `${(data.avgCtr * 100).toFixed(2)}%` },
    { label: "Avg Position", value: data.avgPosition.toFixed(1) },
  ]
  return (
    <div className="rounded-md border bg-card grid grid-cols-2 lg:grid-cols-4 divide-x sm:divide-y-0 divide-y">
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
