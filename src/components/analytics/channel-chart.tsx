"use client"

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import type { ChannelRow } from "@/types/analytics"

const COLORS = [
  "var(--primary)",
  "hsl(220 60% 60%)",
  "hsl(160 60% 50%)",
  "hsl(40 80% 55%)",
  "hsl(280 60% 60%)",
]

export function ChannelChart({ data }: { data: ChannelRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical">
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis dataKey="channel" type="category" tick={{ fontSize: 11 }} width={110} />
        <Tooltip />
        <Bar dataKey="sessions" name="Sessions" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
