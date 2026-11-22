"use client"

import { Hint } from "@/components/ui/hint"
import { AlertTriangle, TrendingDown, TrendingUp, X } from "lucide-react"
import { useSearchParamSetter } from "@/hooks/use-search-param-setter"
import { DASHBOARD_RANGES, DEFAULT_RANGE, type DashboardRangeKey } from "@/lib/date-range"
import {
  CATEGORY_PARAM,
  HEALTH_PARAM,
  ISSUES_PARAM,
  RANGE_PARAM,
  TREND_PARAM,
  type TrendFilter,
} from "@/lib/dashboard-params"

interface CategoryOption {
  id: number
  name: string
  count: number
}

interface Props {
  categories: CategoryOption[]
  /** Currently selected category id, or null for "All". */
  selectedCategoryId: number | null
  /** Whether the issues-only toggle is on. */
  issuesOnly: boolean
  /** Total card count after current filters — shown next to "All" chip
   *  so the user knows how many domains the KPI strip is summarising. */
  filteredCount: number
  totalCount: number
  /**
   * Period the cards and KPI strip cover, plus the trend filter and how many
   * domains each trend option would show. Optional so pages without these
   * controls (the analytics comparison page) keep the plain category row.
   */
  range?: DashboardRangeKey
  trend?: TrendFilter | null
  trendCounts?: { down: number; up: number }
  /** True when a health pip in the KPI strip is narrowing the list. */
  healthFilterActive?: boolean
}

export function DashboardFilters({
  categories,
  selectedCategoryId,
  issuesOnly,
  filteredCount,
  totalCount,
  range,
  trend = null,
  trendCounts,
  healthFilterActive = false,
}: Props) {
  const setParams = useSearchParamSetter()

  const anyFilter =
    selectedCategoryId !== null || issuesOnly || trend !== null || healthFilterActive

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <Chip
        active={selectedCategoryId === null}
        onClick={() => setParams({ [CATEGORY_PARAM]: null })}
      >
        All{" "}
        <span className="text-[10px] opacity-70">
          ({filteredCount === totalCount ? totalCount : `${filteredCount}/${totalCount}`})
        </span>
      </Chip>
      {categories.map((c) => (
        <Chip
          key={c.id}
          active={selectedCategoryId === c.id}
          onClick={() => setParams({ [CATEGORY_PARAM]: String(c.id) })}
        >
          {c.name}{" "}
          <span className="text-[10px] opacity-70">({c.count})</span>
        </Chip>
      ))}

      <span className="mx-1 h-4 w-px bg-border" aria-hidden />

      <Hint text="Show only domains with active issues — sync errors, stale data, unlinked sources, or CWV / sitemap problems.">
        <button
          type="button"
          // The health pips in the KPI strip are a finer-grained version of
          // this toggle, so switching it on replaces any pip selection.
          onClick={() =>
            setParams({ [ISSUES_PARAM]: issuesOnly ? null : "1", [HEALTH_PARAM]: null })
          }
          aria-pressed={issuesOnly}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs border transition-colors cursor-help ${
            issuesOnly
              ? "bg-red-50 border-red-300 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:border-red-800 dark:text-red-300"
              : "bg-background border-input text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          <AlertTriangle className="w-3 h-3" />
          Issues only
        </button>
      </Hint>

      {trendCounts && (
        <>
          <Hint text="Domains where sessions or search clicks over the last 7 days run at least 10% below their average for the selected period. Sites with too little traffic to judge are left out.">
            <button
              type="button"
              onClick={() => setParams({ [TREND_PARAM]: trend === "down" ? null : "down" })}
              aria-pressed={trend === "down"}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs border transition-colors cursor-help ${
                trend === "down"
                  ? "bg-red-50 border-red-300 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:border-red-800 dark:text-red-300"
                  : "bg-background border-input text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <TrendingDown className="w-3 h-3" />
              Declining{" "}
              <span className="text-[10px] opacity-70">({trendCounts.down})</span>
            </button>
          </Hint>
          <Hint text="Domains where sessions or search clicks over the last 7 days run at least 10% above their average for the selected period, and nothing is falling.">
            <button
              type="button"
              onClick={() => setParams({ [TREND_PARAM]: trend === "up" ? null : "up" })}
              aria-pressed={trend === "up"}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs border transition-colors cursor-help ${
                trend === "up"
                  ? "bg-green-50 border-green-300 text-green-700 hover:bg-green-100 dark:bg-green-950 dark:border-green-800 dark:text-green-300"
                  : "bg-background border-input text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <TrendingUp className="w-3 h-3" />
              Growing{" "}
              <span className="text-[10px] opacity-70">({trendCounts.up})</span>
            </button>
          </Hint>
        </>
      )}

      {anyFilter && (
        <button
          type="button"
          onClick={() =>
            setParams({
              [CATEGORY_PARAM]: null,
              [ISSUES_PARAM]: null,
              [TREND_PARAM]: null,
              [HEALTH_PARAM]: null,
            })
          }
          className="inline-flex items-center gap-0.5 px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="w-3 h-3" />
          Clear
        </button>
      )}

      {range && (
        <div
          className="ml-auto inline-flex rounded-md border bg-background p-0.5 text-xs"
          role="group"
          aria-label="Period"
        >
          {DASHBOARD_RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() =>
                setParams({ [RANGE_PARAM]: r.key === DEFAULT_RANGE ? null : r.key })
              }
              aria-pressed={range === r.key}
              className={`px-2 py-1 rounded-sm transition-colors ${
                range === r.key
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
        active
          ? "bg-accent text-accent-foreground border-accent font-medium"
          : "bg-background border-input text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {children}
    </button>
  )
}
