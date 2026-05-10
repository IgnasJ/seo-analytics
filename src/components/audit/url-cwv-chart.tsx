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

interface Point {
  audit: Audit
  result: AuditResult
}

interface Props {
  points: Point[]
}

// LCP / TBT / FCP / SI live on the left axis in ms. CLS is unit-less ~ 0..1
// so it gets its own right-hand axis to avoid being a flat line at the bottom.
const SERIES = [
  { key: "lcp", label: "LCP (ms)", colour: "#ef4444", axis: "left" as const },
  { key: "tbt", label: "TBT (ms)", colour: "#f59e0b", axis: "left" as const },
  { key: "fcp", label: "FCP (ms)", colour: "#3b82f6", axis: "left" as const },
  { key: "si", label: "SI (ms)", colour: "#8b5cf6", axis: "left" as const },
  { key: "cls", label: "CLS", colour: "#10b981", axis: "right" as const },
] as const

export function UrlCwvChart({ points }: Props) {
  const { isHidden, hovered, setHovered, toggle, legendFormatter } =
    useLegendVisibility()

  const rows = [...points].reverse().map((p) => ({
    label: shortLabel(p.audit.requested_at),
    lcp: p.result.labCwv.lcp,
    tbt: p.result.labCwv.tbt,
    fcp: p.result.labCwv.fcp,
    si: p.result.labCwv.si,
    cls: p.result.labCwv.cls,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11 }}
          domain={[0, "auto"]}
        />
        <Tooltip content={<CwvTooltip />} />
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
              yAxisId={s.axis}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.colour}
              strokeWidth={isHov ? 2.6 : 1.8}
              strokeOpacity={isOther ? 0.18 : 1}
              dot={{ r: 2 }}
              activeDot={{ r: isHov ? 5 : 4 }}
              connectNulls
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

function CwvTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean
  label?: string
  payload?: { name?: string; value?: number; color?: string; dataKey?: string }[]
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-md border bg-background px-3 py-2 shadow-md text-xs">
      <div className="font-medium mb-1.5">{label}</div>
      <ul className="space-y-1">
        {payload.map((p) => {
          const k = p.dataKey
          const v = p.value
          let display = "—"
          if (typeof v === "number") {
            if (k === "cls") display = v.toFixed(3)
            else display = v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`
          }
          return (
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
              <span className="font-mono tabular-nums">{display}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
