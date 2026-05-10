"use client"

import { useEffect, useMemo, useState } from "react"
import type { QueryRow } from "@/types/search-console"
import { PageNav } from "@/components/ui/page-nav"
import {
  FilterBar,
  SortHeader,
} from "@/components/analytics/top-pages-table"

const PAGE_SIZE = 15

type SortKey = "query" | "clicks" | "impressions" | "ctr" | "position"
type SortDir = "asc" | "desc"

export function TopQueriesTable({ data }: { data: QueryRow[] }) {
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<SortKey>("clicks")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [filterOpen, setFilterOpen] = useState(false)
  const [filter, setFilter] = useState("")

  useEffect(() => {
    setPage(1)
  }, [data, filter, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      // Position is a "lower is better" metric, so default to ascending; the
      // text query column also defaults ascending. Other metrics descend.
      const ascendingByDefault = key === "query" || key === "position"
      setSortDir(ascendingByDefault ? "asc" : "desc")
    }
  }

  const processed = useMemo(() => {
    const f = filter.trim().toLowerCase()
    let rows = f ? data.filter((r) => r.query.toLowerCase().includes(f)) : data
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return sortDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number)
    })
    return rows
  }, [data, filter, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(processed.length / PAGE_SIZE))
  const start = (page - 1) * PAGE_SIZE
  const slice = processed.slice(start, start + PAGE_SIZE)
  const end = Math.min(start + PAGE_SIZE, processed.length)

  return (
    <div className="space-y-3">
      <FilterBar
        open={filterOpen}
        onToggle={() => setFilterOpen((o) => !o)}
        value={filter}
        onChange={setFilter}
        placeholder="Filter by query substring"
        matchCount={processed.length}
        totalCount={data.length}
      />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <SortHeader
                label="Query"
                sortKey="query"
                currentKey={sortKey}
                currentDir={sortDir}
                onToggle={toggleSort}
                align="left"
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
                label="Impr."
                sortKey="impressions"
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
                label="Pos."
                sortKey="position"
                currentKey={sortKey}
                currentDir={sortDir}
                onToggle={toggleSort}
                align="right"
              />
            </tr>
          </thead>
          <tbody>
            {slice.map((row, i) => (
              <tr key={start + i} className="border-b last:border-0">
                <td className="py-2 truncate max-w-[200px]">{row.query}</td>
                <td className="py-2 text-right">{row.clicks}</td>
                <td className="py-2 text-right">
                  {row.impressions.toLocaleString()}
                </td>
                <td className="py-2 text-right">
                  {(row.ctr * 100).toFixed(1)}%
                </td>
                <td className="py-2 text-right">{row.position.toFixed(1)}</td>
              </tr>
            ))}
            {slice.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="py-4 text-center text-muted-foreground text-xs"
                >
                  {filter
                    ? "No queries match your filter."
                    : "No queries in this range."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {processed.length > PAGE_SIZE && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-muted-foreground">
          <span className="whitespace-nowrap">
            Showing{" "}
            <strong>
              {start + 1}–{end}
            </strong>{" "}
            of <strong>{processed.length}</strong>
          </span>
          <PageNav
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  )
}
