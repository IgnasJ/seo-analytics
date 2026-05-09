"use client"

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts"
import type { DailyGscRow } from "@/types/search-console"

export function GscChart({ data }: { data: DailyGscRow[] }) {
  const formatted = data.map((d) => ({
    ...d,
    date: `${d.date.slice(5, 7)}/${d.date.slice(8, 10)}`,
  }))
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend />
        <Line yAxisId="left" type="monotone" dataKey="clicks" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Clicks" />
        <Line yAxisId="right" type="monotone" dataKey="impressions" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} dot={false} name="Impressions" />
      </LineChart>
    </ResponsiveContainer>
  )
}
