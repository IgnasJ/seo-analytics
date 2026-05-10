"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Hint } from "@/components/ui/hint"
import { AlertTriangle } from "lucide-react"

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
}

const CATEGORY_PARAM = "category"
const ISSUES_PARAM = "issues"

export function DashboardFilters({
  categories,
  selectedCategoryId,
  issuesOnly,
  filteredCount,
  totalCount,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params)
    if (value === null) next.delete(key)
    else next.set(key, value)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <Chip
        active={selectedCategoryId === null}
        onClick={() => setParam(CATEGORY_PARAM, null)}
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
          onClick={() => setParam(CATEGORY_PARAM, String(c.id))}
        >
          {c.name}{" "}
          <span className="text-[10px] opacity-70">({c.count})</span>
        </Chip>
      ))}

      <span className="mx-1 h-4 w-px bg-border" aria-hidden />

      <Hint text="Show only domains with active issues — sync errors, stale data, unlinked sources, or CWV / sitemap problems.">
        <button
          type="button"
          onClick={() => setParam(ISSUES_PARAM, issuesOnly ? null : "1")}
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
