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

export function TrafficChart({ data }: { data: DailyRow[] }) {
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
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="sessions"
          stroke="var(--primary)"
          strokeWidth={2}
          dot={false}
          name="Sessions"
        />
        <Line
          type="monotone"
          dataKey="users"
          stroke="var(--muted-foreground)"
          strokeWidth={1.5}
          dot={false}
          name="Users"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
