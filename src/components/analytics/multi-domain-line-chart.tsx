"use client"

import { useState } from "react"
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
import { formatInteger } from "@/lib/format"

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
  /** Ordered list of every date that appears in any series. */
  dateKeys: string[]
  /** Override the chart height; defaults to 260. */
  height?: number
}

/**
 * Multi-line trend chart with one line per domain. Hover behaviour:
 * - Hovering anywhere on the chart shows a tooltip with every visible
 *   domain's value at that date, sorted highest → lowest, scrolling if
 *   there are too many to fit. Replaces recharts' default tooltip which
 *   sometimes hid entries.
 * - Hovering a legend pill highlights that domain's line (full opacity,
 *   thicker stroke) and dims the rest. Click any pill to mute that line
 *   entirely (recharts default, preserved).
 */
export function MultiDomainLineChart({ series, dateKeys, height = 260 }: Props) {
  const [hoveredDomain, setHoveredDomain] = useState<string | null>(null)

  if (series.length === 0 || dateKeys.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        No data to chart yet.
      </div>
    )
  }

  // Pivot to per-date rows for recharts.
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
      <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip
          content={<RichTooltip />}
          cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
        />
        <Legend
          wrapperStyle={{ fontSize: "11px", paddingTop: 8 }}
          onMouseEnter={(payload) => {
            const name = (payload as { dataKey?: string })?.dataKey
            if (typeof name === "string") setHoveredDomain(name)
          }}
          onMouseLeave={() => setHoveredDomain(null)}
        />
        {series.map((s) => {
          const isHovered = hoveredDomain === s.hostname
          const isOtherHovered = hoveredDomain !== null && !isHovered
          return (
            <Line
              key={s.domainId}
              type="monotone"
              dataKey={s.hostname}
              stroke={domainColour(s.domainId)}
              strokeWidth={isHovered ? 2.6 : 1.6}
              strokeOpacity={isOtherHovered ? 0.18 : 1}
              dot={false}
              activeDot={{ r: isHovered ? 5 : 3 }}
              name={s.hostname}
              isAnimationActive={false}
            />
          )
        })}
      </LineChart>
    </ResponsiveContainer>
  )
}

interface TooltipPayloadEntry {
  name?: string
  value?: number
  color?: string
}
interface RichTooltipProps {
  active?: boolean
  label?: string
  payload?: TooltipPayloadEntry[]
}

/**
 * Custom tooltip:
 * - Renders every series with non-zero value at the hovered date.
 * - Sorts highest → lowest so the dominant domain is first.
 * - Caps height + scrolls so a 30-domain chart's tooltip doesn't engulf
 *   the chart itself.
 */
function RichTooltip({ active, label, payload }: RichTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const visible = payload
    .filter((p): p is TooltipPayloadEntry => Boolean(p))
    .filter((p) => typeof p.value === "number" && (p.value as number) > 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

  return (
    <div className="rounded-md border bg-background px-3 py-2 shadow-md text-xs max-h-60 overflow-y-auto">
      <div className="font-medium mb-1.5">{label}</div>
      {visible.length === 0 ? (
        <div className="text-muted-foreground">No data.</div>
      ) : (
        <ul className="space-y-1">
          {visible.map((p) => (
            <li
              key={p.name ?? "?"}
              className="flex items-center justify-between gap-3"
            >
              <span className="flex items-center gap-1.5 truncate max-w-[180px]">
                <span
                  className="inline-block w-2 h-2 rounded-sm shrink-0"
                  style={{ backgroundColor: p.color }}
                />
                <span className="truncate" title={p.name}>
                  {p.name}
                </span>
              </span>
              <span className="font-mono tabular-nums shrink-0">
                {formatInteger(p.value ?? 0)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function shortDate(d: string): string {
  // GA4 daily key is "YYYYMMDD"; GSC is "YYYY-MM-DD". Normalise to MM/DD.
  if (/^\d{8}$/.test(d)) return `${d.slice(4, 6)}/${d.slice(6, 8)}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return `${d.slice(5, 7)}/${d.slice(8, 10)}`
  return d
}
