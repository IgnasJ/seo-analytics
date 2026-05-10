"use client"

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { Smartphone, Monitor, Tablet, HelpCircle } from "lucide-react"
import type { DeviceRow } from "@/types/analytics"
import { formatInteger } from "@/lib/format"

const DEVICE_COLOURS: Record<string, string> = {
  desktop: "#3b82f6", // blue-500
  mobile: "#10b981", // emerald-500
  tablet: "#f59e0b", // amber-500
}

const DEVICE_FALLBACK = "#94a3b8" // slate-400

function deviceIcon(d: string) {
  if (d === "mobile") return Smartphone
  if (d === "tablet") return Tablet
  if (d === "desktop") return Monitor
  return HelpCircle
}

export function DeviceChart({ data }: { data: DeviceRow[] }) {
  const totalSessions = data.reduce((s, d) => s + d.sessions, 0)
  if (totalSessions === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No device data yet.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            dataKey="sessions"
            nameKey="device"
            innerRadius={40}
            outerRadius={70}
            paddingAngle={2}
            stroke="var(--background)"
          >
            {data.map((d) => (
              <Cell
                key={d.device}
                fill={DEVICE_COLOURS[d.device] ?? DEVICE_FALLBACK}
              />
            ))}
          </Pie>
          <Tooltip />
          <Legend
            verticalAlign="bottom"
            height={20}
            wrapperStyle={{ fontSize: "11px" }}
          />
        </PieChart>
      </ResponsiveContainer>
      <ul className="space-y-1.5 text-sm">
        {data.map((d) => {
          const Icon = deviceIcon(d.device)
          const pct = ((d.sessions / totalSessions) * 100).toFixed(1)
          return (
            <li key={d.device} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 capitalize">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{
                    backgroundColor:
                      DEVICE_COLOURS[d.device] ?? DEVICE_FALLBACK,
                  }}
                />
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                {d.device}
              </span>
              <span className="text-xs tabular-nums">
                <span className="font-medium">
                  {formatInteger(d.sessions)}
                </span>{" "}
                <span className="text-muted-foreground">({pct}%)</span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
