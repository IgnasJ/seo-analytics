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
