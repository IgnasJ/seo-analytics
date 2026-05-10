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
import { useLegendVisibility } from "@/hooks/use-legend-visibility"
import type { Audit, AuditResult } from "@/types/audit"
import { formatDateTime } from "@/lib/format"

interface Point {
  audit: Audit
  result: AuditResult
}

interface Props {
  points: Point[]
}

const SERIES = [
  { key: "performance", label: "Performance", colour: "#3b82f6" },
  { key: "accessibility", label: "Accessibility", colour: "#10b981" },
  { key: "bestPractices", label: "Best Practices", colour: "#f59e0b" },
  { key: "seo", label: "SEO", colour: "#8b5cf6" },
] as const

/**
 * Four-line score trend for `/audit/url`. Each x is one audit; the line
 * series are the four Lighthouse category scores 0..100.
 */
export function UrlScoreChart({ points }: Props) {
  const { isHidden, hovered, setHovered, toggle, legendFormatter } =
    useLegendVisibility()

  // Reverse so the oldest audit is on the left — natural time direction. The
  // server-side list is newest-first to make the table read right.
  const rows = [...points].reverse().map((p) => ({
    label: shortLabel(p.audit.requested_at),
    fullLabel: formatDateTime(p.audit.requested_at),
    performance: p.result.scores.performance,
    accessibility: p.result.scores.accessibility,
    bestPractices: p.result.scores.bestPractices,
    seo: p.result.scores.seo,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
        <Tooltip content={<ScoreTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: "11px", paddingTop: 8, cursor: "pointer" }}
          onMouseEnter={(payload) => {
            const name = (payload as { dataKey?: string })?.dataKey
            if (typeof name === "string") setHovered(name)
          }}
          onMouseLeave={() => setHovered(null)}
          onClick={(payload) => {
            const name = (payload as { dataKey?: string })?.dataKey
            if (typeof name === "string") toggle(name)
          }}
          formatter={legendFormatter}
        />
        {SERIES.map((s) => {
          const isOff = isHidden(s.key)
          const isHov = hovered === s.key
          const isOther = hovered !== null && !isHov
          return (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.colour}
              strokeWidth={isHov ? 2.6 : 1.8}
              strokeOpacity={isOther ? 0.18 : 1}
              dot={{ r: 2 }}
              activeDot={{ r: isHov ? 5 : 4 }}
              isAnimationActive={false}
              hide={isOff}
            />
          )
        })}
      </LineChart>
    </ResponsiveContainer>
  )
}

function shortLabel(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000)
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  const HH = String(d.getHours()).padStart(2, "0")
  const MI = String(d.getMinutes()).padStart(2, "0")
  return `${mm}/${dd} ${HH}:${MI}`
}

function ScoreTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean
  label?: string
  payload?: { name?: string; value?: number; color?: string }[]
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-md border bg-background px-3 py-2 shadow-md text-xs">
      <div className="font-medium mb-1.5">{label}</div>
      <ul className="space-y-1">
        {payload.map((p) => (
          <li
            key={p.name ?? "?"}
            className="flex items-center justify-between gap-4"
          >
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-sm"
                style={{ backgroundColor: p.color }}
              />
              {p.name}
            </span>
            <span className="font-mono tabular-nums">
              {typeof p.value === "number" ? p.value : "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
