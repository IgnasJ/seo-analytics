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
import type { DailyRow } from "@/types/analytics"
import { useLegendVisibility } from "@/hooks/use-legend-visibility"
import { formatInteger } from "@/lib/format"

const SERIES = [
  { key: "sessions", label: "Sessions", colour: "var(--primary)" },
  { key: "users", label: "Users", colour: "var(--muted-foreground)" },
] as const

export function TrafficChart({ data }: { data: DailyRow[] }) {
  const { isHidden, hovered, setHovered, toggle, legendFormatter } =
    useLegendVisibility()

  const formatted = data.map((d) => ({
    ...d,
    date: `${d.date.slice(4, 6)}/${d.date.slice(6, 8)}`,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip content={<DualTooltip />} />
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
          const isHovered = hovered === s.key
          const isOtherHovered = hovered !== null && !isHovered
          return (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.colour}
              strokeWidth={isHovered ? 2.6 : 1.8}
              strokeOpacity={isOtherHovered ? 0.18 : 1}
              dot={false}
              activeDot={{ r: isHovered ? 5 : 3 }}
              name={s.label}
              isAnimationActive={false}
              hide={isOff}
            />
          )
        })}
      </LineChart>
    </ResponsiveContainer>
  )
}

function DualTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean
  label?: string
  payload?: { name?: string; value?: number; color?: string }[]
}) {
  if (!active || !payload || payload.length === 0) return null
  const rows = payload.filter((p) => typeof p.value === "number")
  if (rows.length === 0) return null
  return (
    <div className="rounded-md border bg-background px-3 py-2 shadow-md text-xs">
      <div className="font-medium mb-1.5">{label}</div>
      <ul className="space-y-1">
        {rows.map((p) => (
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
              {formatInteger(p.value ?? 0)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
