"use client"

import { useEffect, useMemo, useState } from "react"
import type { PageRow } from "@/types/analytics"
import { PageNav } from "@/components/ui/page-nav"
import { Button } from "@/components/ui/button"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Filter,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react"

const PAGE_SIZE = 10

type SortKey = "pagePath" | "sessions" | "pageviews"
type SortDir = "asc" | "desc"

export function TopPagesTable({ data }: { data: PageRow[] }) {
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<SortKey>("sessions")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [filterOpen, setFilterOpen] = useState(false)
  const [filter, setFilter] = useState("")

  // Reset to page 1 when the underlying dataset, filter, or sort changes.
  useEffect(() => {
    setPage(1)
  }, [data, filter, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      // Default direction depends on column type — descending makes sense for
      // numeric metrics ("biggest first"), ascending for the page path.
      setSortDir(key === "pagePath" ? "asc" : "desc")
    }
  }

  const processed = useMemo(() => {
    const f = filter.trim().toLowerCase()
    let rows = f
      ? data.filter((r) => r.pagePath.toLowerCase().includes(f))
      : data
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
        placeholder="Filter by URL fragment (e.g. /blog/)"
        matchCount={processed.length}
        totalCount={data.length}
      />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <SortHeader
                label="Page"
                sortKey="pagePath"
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
                label="Pageviews"
                sortKey="pageviews"
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
                <td className="py-2 font-mono text-xs truncate max-w-[240px]">
                  {row.pagePath}
                </td>
                <td className="py-2 text-right">
                  {row.sessions.toLocaleString()}
                </td>
                <td className="py-2 text-right">
                  {row.pageviews.toLocaleString()}
                </td>
              </tr>
            ))}
            {slice.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="py-4 text-center text-muted-foreground text-xs"
                >
                  {filter ? "No pages match your filter." : "No pages in this range."}
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

interface SortHeaderProps<K extends string> {
  label: string
  sortKey: K
  currentKey: K
  currentDir: SortDir
  onToggle: (key: K) => void
  align: "left" | "right"
}

export function SortHeader<K extends string>({
  label,
  sortKey,
  currentKey,
  currentDir,
  onToggle,
  align,
}: SortHeaderProps<K>) {
  const active = currentKey === sortKey
  const Icon = !active ? ArrowUpDown : currentDir === "asc" ? ArrowUp : ArrowDown
  return (
    <th className={align === "right" ? "text-right pb-2" : "text-left pb-2"}>
      <button
        type="button"
        onClick={() => onToggle(sortKey)}
        className={
          "inline-flex items-center gap-1 font-medium hover:text-foreground transition-colors " +
          (active ? "text-foreground" : "")
        }
      >
        {align === "right" && <Icon className="w-3 h-3" />}
        {label}
        {align === "left" && <Icon className="w-3 h-3" />}
      </button>
    </th>
  )
}

interface FilterBarProps {
  open: boolean
  onToggle: () => void
  value: string
  onChange: (v: string) => void
  placeholder: string
  matchCount: number
  totalCount: number
}

export function FilterBar({
  open,
  onToggle,
  value,
  onChange,
  placeholder,
  matchCount,
  totalCount,
}: FilterBarProps) {
  const filtering = value.trim().length > 0
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {open ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
          <Filter className="w-3 h-3" />
          {filtering ? `Filter active (${matchCount} of ${totalCount})` : "Filter"}
        </button>
      </div>
      {open && (
        <div className="flex gap-2">
          <input
            className="flex-1 border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          {value && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange("")}
              aria-label="Clear filter"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
