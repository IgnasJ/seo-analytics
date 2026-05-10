"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts"
import { domainColour } from "./domain-colour"

export interface DomainSeries {
  domainId: number
  hostname: string
  /** Series of { date: "YYYY-MM-DD", value: number }. Dates aligned across
   *  series via the `dateKeys` prop on the parent so sparse domains line up
   *  correctly. */
  data: Array<{ date: string; value: number }>
}

interface Props {
  series: DomainSeries[]
  /** Ordered list of every date that appears in any series. Used so the
   *  X-axis is the same across charts and missing-data days are explicit
   *  zeros rather than gaps. */
  dateKeys: string[]
  /** Override the chart height; defaults to 240. */
  height?: number
}

/**
 * Multi-line trend chart with one line per domain. Same domain → same colour
 * via domainColour(). Click a domain in the legend to toggle that line on
 * or off (recharts handles this natively). Auto-scales Y to the union of
 * all visible series.
 */
export function MultiDomainLineChart({ series, dateKeys, height = 240 }: Props) {
  if (series.length === 0 || dateKeys.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        No data to chart yet.
      </div>
    )
  }

  // Pivot from per-domain series → per-date row with a key per domain.
  // Recharts wants the second shape; we keep the per-series shape on input
  // because that's how the page loop builds it.
  const rows = dateKeys.map((date) => {
    const row: Record<string, string | number> = { date: shortDate(date) }
    for (const s of series) {
      const point = s.data.find((p) => p.date === date)
      row[s.hostname] = point?.value ?? 0
    }
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: "11px", paddingTop: 8 }} />
        {series.map((s) => (
          <Line
            key={s.domainId}
            type="monotone"
            dataKey={s.hostname}
            stroke={domainColour(s.domainId)}
            strokeWidth={1.6}
            dot={false}
            name={s.hostname}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

function shortDate(d: string): string {
  // GA4 daily key is "YYYYMMDD"; GSC is "YYYY-MM-DD". Normalise to MM/DD.
  if (/^\d{8}$/.test(d)) return `${d.slice(4, 6)}/${d.slice(6, 8)}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return `${d.slice(5, 7)}/${d.slice(8, 10)}`
  return d
}
