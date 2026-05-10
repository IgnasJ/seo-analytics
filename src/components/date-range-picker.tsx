"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { DATE_RANGES, type DateRangeKey } from "@/lib/date-range"

// Re-export server-safe values for callers that already import from this
// component module. Prefer `@/lib/date-range` directly when you don't need
// the picker UI at all.
export { DATE_RANGES, DEFAULT_RANGE, isDateRangeKey } from "@/lib/date-range"
export type { DateRangeKey } from "@/lib/date-range"

interface ControlledProps {
  selected: DateRangeKey
  onChange: (key: DateRangeKey) => void
}

/**
 * Pure controlled date range picker — caller manages selection state.
 */
export function DateRangePicker({ selected, onChange }: ControlledProps) {
  return (
    <div className="flex gap-1 flex-wrap">
      {DATE_RANGES.map((range) => (
        <button
          key={range.key}
          onClick={() => onChange(range.key)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            selected === range.key
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          }`}
        >
          {range.label}
        </button>
      ))}
    </div>
  )
}

/**
 * URL-bound variant: pushes ?range=<key> via the App Router. Use this when
 * the page is a server component that re-renders on URL change so cached
 * data for the new range can be fetched server-side.
 */
export function DateRangePickerLink({
  selected,
  paramName = "range",
}: {
  selected: DateRangeKey
  paramName?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  function setRange(key: DateRangeKey) {
    const next = new URLSearchParams(params)
    next.set(paramName, key)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

  return <DateRangePicker selected={selected} onChange={setRange} />
}
