// URL query parameters that drive the dashboard's filters. Kept in a plain
// module (not in a "use client" component file) so the server-rendered page
// and the client filter controls can both import the actual string values.

export const CATEGORY_PARAM = "category"
export const ISSUES_PARAM = "issues"
export const RANGE_PARAM = "range"
export const TREND_PARAM = "trend"
export const HEALTH_PARAM = "health"

export type TrendFilter = "down" | "up"

export function parseTrendFilter(value: unknown): TrendFilter | null {
  return value === "down" || value === "up" ? value : null
}

export type HealthFilter = "green" | "amber" | "red"

export function parseHealthFilter(value: unknown): HealthFilter | null {
  return value === "green" || value === "amber" || value === "red" ? value : null
}
