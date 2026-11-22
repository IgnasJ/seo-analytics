// Server-safe constants for the date range picker. Kept out of
// `src/components/date-range-picker.tsx` (which is a client component) so
// route handlers and server components can validate / use the values.

export const DATE_RANGES = [
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

/**
 * Ranges offered on the dashboard. The single-day ranges are left out: Search
 * Console has no data that fresh, and a one-day total can't carry a trend.
 */
export const DASHBOARD_RANGES = DATE_RANGES.filter(
  (r) => r.key !== "today" && r.key !== "yesterday"
)

export type DashboardRangeKey = Exclude<DateRangeKey, "today" | "yesterday">

export function isDashboardRangeKey(value: unknown): value is DashboardRangeKey {
  return DASHBOARD_RANGES.some((r) => r.key === value)
}

const RANGE_PHRASES: Record<DateRangeKey, string> = {
  today: "today",
  yesterday: "yesterday",
  "7d": "the last 7 days",
  "1m": "the last 30 days",
  "90d": "the last 90 days",
  "1y": "the last 12 months",
}

/** Range as it reads mid-sentence: "sessions over the last 30 days". */
export function rangePhrase(key: DateRangeKey): string {
  return RANGE_PHRASES[key]
}
