"use client"

import { Search, X } from "lucide-react"
import type { AuditStatus } from "@/types/audit"

export type StatusFilter = "all" | AuditStatus
export type DateWindow = "7d" | "30d" | "90d" | "all"
/** `domain` folds by hostname (the default), `grouped` folds by URL, `flat`
 *  shows one row per audit. */
export type ViewMode = "domain" | "grouped" | "flat"

const STATUS_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "done", label: "Done" },
  { key: "error", label: "Error" },
  { key: "pending", label: "Pending" },
]

const DATE_OPTIONS: { key: DateWindow; label: string }[] = [
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
  { key: "all", label: "All time" },
]

interface Props {
  search: string
  onSearchChange: (v: string) => void
  status: StatusFilter
  onStatusChange: (v: StatusFilter) => void
  since: DateWindow
  onSinceChange: (v: DateWindow) => void
  view: ViewMode
  onViewChange: (v: ViewMode) => void
}

/**
 * Compact filter bar above the history list. Search input + status pills +
 * date-window pills on the left; [Flat | Grouped] mode toggle on the right.
 * All four values are owned by the parent — this is a presentational shell
 * so the parent can URL-bind them in one place.
 */
export function HistoryFilterBar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  since,
  onSinceChange,
  view,
  onViewChange,
}: Props) {
  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            suppressHydrationWarning
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search URL…"
            className="w-full border rounded-md pl-7 pr-7 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="inline-flex items-center rounded-md border overflow-hidden text-xs shrink-0">
          {(
            [
              { key: "domain", label: "By domain" },
              { key: "grouped", label: "By URL" },
              { key: "flat", label: "Flat" },
            ] as { key: ViewMode; label: string }[]
          ).map((opt) => {
            const active = opt.key === view
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => onViewChange(opt.key)}
                aria-pressed={active}
                className={
                  "px-2.5 py-1.5 transition-colors " +
                  (active
                    ? "bg-foreground text-background"
                    : "hover:bg-muted")
                }
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex flex-wrap gap-1 text-xs">
        {STATUS_OPTIONS.map((o) => {
          const active = o.key === status
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => onStatusChange(o.key)}
              aria-pressed={active}
              className={
                "px-2 py-1 rounded-md border transition-colors " +
                (active
                  ? "bg-foreground text-background border-foreground"
                  : "hover:bg-muted")
              }
            >
              {o.label}
            </button>
          )
        })}
        <span className="text-muted-foreground self-center px-1">·</span>
        {DATE_OPTIONS.map((o) => {
          const active = o.key === since
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => onSinceChange(o.key)}
              aria-pressed={active}
              className={
                "px-2 py-1 rounded-md border transition-colors " +
                (active
                  ? "bg-foreground text-background border-foreground"
                  : "hover:bg-muted")
              }
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
