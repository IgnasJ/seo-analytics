"use client"

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import type { CountryRow } from "@/types/analytics"

const TOP_N = 5

export function CountryChart({ data }: { data: CountryRow[] }) {
  // Take the top 10 by sessions; the rest of the list (long-tail countries)
  // gets bucketed into a single "Other" row so the chart doesn't render 50
  // half-pixel-tall bars.
  const sorted = [...data].sort((a, b) => b.sessions - a.sessions)
  const top = sorted.slice(0, TOP_N)
  const rest = sorted.slice(TOP_N)
  const otherSessions = rest.reduce((s, r) => s + r.sessions, 0)
  const display = otherSessions > 0
    ? [...top, { country: "Other", sessions: otherSessions, users: 0 }]
    : top

  if (display.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No country data yet.
      </p>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, display.length * 28)}>
      <BarChart
        data={display}
        layout="vertical"
        margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
      >
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis
          dataKey="country"
          type="category"
          tick={{ fontSize: 11 }}
          width={110}
          // interval={0} forces every label to render. The default "auto"
          // skips alternate labels whenever recharts *thinks* they would
          // overlap, even when there's actually room — which is what was
          // hiding every other country.
          interval={0}
        />
        <Tooltip />
        <Bar
          dataKey="sessions"
          fill="var(--primary)"
          name="Sessions"
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
