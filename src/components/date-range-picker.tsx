"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

const DATE_RANGES = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "7 days" },
  { key: "1m", label: "1 month" },
  { key: "90d", label: "90 days" },
  { key: "1y", label: "1 year" },
] as const

export type DateRangeKey = (typeof DATE_RANGES)[number]["key"]

export const DEFAULT_RANGE: DateRangeKey = "1m"

export function isDateRangeKey(value: unknown): value is DateRangeKey {
  return DATE_RANGES.some((r) => r.key === value)
}

interface ControlledProps {
  selected: DateRangeKey
  onChange: (key: DateRangeKey) => void
}

/**
 * Pure controlled date range picker — caller manages selection state. Used
 * in client components that fetch their own data.
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
