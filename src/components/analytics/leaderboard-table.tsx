"use client"

import Link from "next/link"
import { useMemo } from "react"
import { useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Hint } from "@/components/ui/hint"
import { SortHeader } from "@/components/analytics/top-pages-table"
import { StatusDot } from "@/components/dashboard/status-dot"
import { formatCompact } from "@/lib/format"
import type { Severity } from "@/lib/seo/health"

export interface LeaderboardRow {
  domainId: number
  hostname: string
  categoryName: string
  sessions: number
  bounceRate: number
  clicks: number
  ctr: number
  position: number | null
  severity: Severity
  reasons: string[]
}

type SortKey =
  | "hostname"
  | "categoryName"
  | "sessions"
  | "bounceRate"
  | "clicks"
  | "ctr"
  | "position"
  | "severity"

type SortDir = "asc" | "desc"

const SEVERITY_RANK: Record<Severity, number> = { red: 0, amber: 1, green: 2 }

const EXCLUDE_PARAM = "exclude"

interface Props {
  rows: LeaderboardRow[]
  /** Set of domain ids currently excluded from trends/breakdowns. Excluded
   *  rows still render here, dimmed, with the toggle showing "EyeOff." */
  excludedIds: number[]
}

export function LeaderboardTable({ rows, excludedIds }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const excluded = useMemo(() => new Set(excludedIds), [excludedIds])

  const [sortKey, setSortKey] = useState<SortKey>("sessions")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  function toggleExclude(domainId: number) {
    const next = new Set(excluded)
    if (next.has(domainId)) next.delete(domainId)
    else next.add(domainId)

    const sp = new URLSearchParams(params)
    if (next.size === 0) {
      sp.delete(EXCLUDE_PARAM)
    } else {
      sp.set(EXCLUDE_PARAM, [...next].sort((a, b) => a - b).join(","))
    }
    const qs = sp.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      // Sensible defaults: text/severity ascending; numeric metrics descending;
      // position ascending (lower is better).
      const ascByDefault =
        key === "hostname" ||
        key === "categoryName" ||
        key === "severity" ||
        key === "position" ||
        key === "bounceRate"
      setSortDir(ascByDefault ? "asc" : "desc")
    }
  }

  const sorted = useMemo(() => {
    const out = [...rows]
    out.sort((a, b) => {
      const av = sortValue(a, sortKey)
      const bv = sortValue(b, sortKey)
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      // Push nulls to the end regardless of direction so "no data" rows
      // don't dominate the top.
      if (av === null && bv === null) return 0
      if (av === null) return 1
      if (bv === null) return -1
      return sortDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number)
    })
    return out
  }, [rows, sortKey, sortDir])

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No domains match the current filters.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="pb-2 w-8">
              <Hint
                text="Click the eye on any row to exclude that domain from the trend charts and breakdown bars above. Excluded domains stay in this table (dimmed) so you can re-include them. Persists in the URL as ?exclude=…"
                className="cursor-help"
              >
                <span className="sr-only">Include / exclude</span>
                <Eye className="w-3 h-3 inline-block" />
              </Hint>
            </th>
            <SortHeader
              label="Domain"
              sortKey="hostname"
              currentKey={sortKey}
              currentDir={sortDir}
              onToggle={toggleSort}
              align="left"
            />
            <SortHeader
              label="Category"
              sortKey="categoryName"
              currentKey={sortKey}
              currentDir={sortDir}
              onToggle={toggleSort}
              align="left"
            />
            <SortHeader
              label="Sessions"
              sortKey="sessions"
              currentKey={sortKey}
              currentDir={sortDir}
              onToggle={toggleSort}
              align="right"
            />
            <SortHeader
              label="Bounce"
              sortKey="bounceRate"
              currentKey={sortKey}
              currentDir={sortDir}
              onToggle={toggleSort}
              align="right"
            />
            <SortHeader
              label="Clicks"
              sortKey="clicks"
              currentKey={sortKey}
              currentDir={sortDir}
              onToggle={toggleSort}
              align="right"
            />
            <SortHeader
              label="CTR"
              sortKey="ctr"
              currentKey={sortKey}
              currentDir={sortDir}
              onToggle={toggleSort}
              align="right"
            />
            <SortHeader
              label="Position"
              sortKey="position"
              currentKey={sortKey}
              currentDir={sortDir}
              onToggle={toggleSort}
              align="right"
            />
            <SortHeader
              label="Status"
              sortKey="severity"
              currentKey={sortKey}
              currentDir={sortDir}
              onToggle={toggleSort}
              align="right"
            />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const isExcluded = excluded.has(r.domainId)
            return (
            <tr
              key={r.domainId}
              className={`border-b last:border-0 hover:bg-muted/40 ${
                isExcluded ? "opacity-40" : ""
              }`}
            >
              <td className="py-2">
                <Hint
                  text={
                    isExcluded
                      ? "Excluded from trend charts and breakdowns. Click to re-include."
                      : "Excluded this domain from trend charts and breakdowns. Leaderboard rows stay visible (dimmed)."
                  }
                  className="cursor-help"
                >
                  <button
                    type="button"
                    onClick={() => toggleExclude(r.domainId)}
                    aria-label={isExcluded ? "Include in comparison" : "Exclude from comparison"}
                    aria-pressed={isExcluded}
                    className="p-1 rounded hover:bg-accent transition-colors"
                  >
                    {isExcluded ? (
                      <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </button>
                </Hint>
              </td>
              <td className="py-2 font-medium">
                <Link
                  href={`/domain/${r.domainId}`}
                  className="hover:underline"
                >
                  {r.hostname}
                </Link>
              </td>
              <td className="py-2">
                <Badge variant="outline" className="text-[10px]">
                  {r.categoryName}
                </Badge>
              </td>
              <td className="py-2 text-right tabular-nums">
                {formatCompact(r.sessions)}
              </td>
              <td className="py-2 text-right tabular-nums">
                {(r.bounceRate * 100).toFixed(0)}%
              </td>
              <td className="py-2 text-right tabular-nums">
                {formatCompact(r.clicks)}
              </td>
              <td className="py-2 text-right tabular-nums">
                {(r.ctr * 100).toFixed(1)}%
              </td>
              <td className="py-2 text-right tabular-nums">
                {r.position !== null ? r.position.toFixed(1) : "—"}
              </td>
              <td className="py-2 text-right">
                <span className="inline-flex justify-end">
                  <StatusDot severity={r.severity} reasons={r.reasons} />
                </span>
              </td>
            </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function sortValue(r: LeaderboardRow, key: SortKey): string | number | null {
  switch (key) {
    case "hostname":
      return r.hostname
    case "categoryName":
      return r.categoryName
    case "sessions":
      return r.sessions
    case "bounceRate":
      return r.bounceRate
    case "clicks":
      return r.clicks
    case "ctr":
      return r.ctr
    case "position":
      return r.position
    case "severity":
      return SEVERITY_RANK[r.severity]
  }
}
