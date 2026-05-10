/**
 * Format a Unix-seconds timestamp as `yyyy-MM-dd HH:mm:ss` in local time.
 * Sortable, unambiguous, and locale-independent — preferred over
 * Date.toLocaleString() for any timestamp surfaced in tables, log views,
 * or diff captions.
 */
export function formatDateTime(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000)
  const yyyy = d.getFullYear()
  const mm = pad2(d.getMonth() + 1)
  const dd = pad2(d.getDate())
  const HH = pad2(d.getHours())
  const MI = pad2(d.getMinutes())
  const SS = pad2(d.getSeconds())
  return `${yyyy}-${mm}-${dd} ${HH}:${MI}:${SS}`
}

function pad2(n: number): string {
  return n < 10 ? "0" + n : String(n)
}

/**
 * Locale-stable integer formatter. Always returns the same string regardless
 * of the host's default locale — critical for SSR'd numbers, where the
 * server (Node) and the browser (whatever the user's OS reports) often
 * disagree on the thousand separator and produce a hydration mismatch.
 *
 * Renders e.g. 1801 as "1,801" everywhere.
 */
const INT_FORMATTER = new Intl.NumberFormat("en-US", { useGrouping: true })

export function formatInteger(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—"
  return INT_FORMATTER.format(Math.round(n))
}

/**
 * Compact number formatter — k/M abbreviation past 10k. Same locale-stable
 * fixed-locale output as formatInteger.
 */
export function formatCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—"
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 10_000) return `${(n / 1000).toFixed(1)}K`
  return INT_FORMATTER.format(Math.round(n))
}
