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
