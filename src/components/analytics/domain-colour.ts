// Hash-based domain → colour assignment. Used by every chart on the
// Analytics comparison page so the same domain renders in the same colour
// across all three trend charts regardless of sort order, filter state,
// or page reload.

/**
 * 12 hand-picked Tailwind 500-shade hex values. Picked to be distinct at
 * a glance, work on both light and dark backgrounds, and avoid red/green
 * confusion (those colours are reserved for status signals elsewhere).
 */
export const DOMAIN_PALETTE = [
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#8b5cf6", // violet-500
  "#f43f5e", // rose-500
  "#06b6d4", // cyan-500
  "#84cc16", // lime-500
  "#f97316", // orange-500
  "#ec4899", // pink-500
  "#0ea5e9", // sky-500
  "#14b8a6", // teal-500
  "#6366f1", // indigo-500
] as const

/**
 * Pick a colour for a given domain id. Stable: the same id always yields
 * the same colour, regardless of how the leaderboard is sorted or filtered.
 *
 * Modulo against the palette length means ids beyond 12 wrap around — two
 * domains can share a colour, but only when there are more than 12 of them
 * and recharts' legend-click-to-mute is a sufficient escape hatch.
 */
export function domainColour(id: number): string {
  // Coerce to integer in case of unexpected inputs.
  const idx = Math.abs(Math.floor(id)) % DOMAIN_PALETTE.length
  return DOMAIN_PALETTE[idx]
}
