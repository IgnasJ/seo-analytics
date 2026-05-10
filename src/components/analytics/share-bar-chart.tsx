"use client"

import { formatInteger } from "@/lib/format"

const SEGMENT_PALETTE = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#84cc16", // lime
  "#94a3b8", // slate (always-last for "Other")
] as const

const OTHER_LABEL = "Other"

interface Segment {
  name: string
  value: number
}

export interface ShareRow {
  /** Display label per row — usually the hostname. */
  label: string
  segments: Segment[]
}

interface Props {
  rows: ShareRow[]
  /** Top-N to keep individually; the rest collapse into "Other". Pass
   *  Infinity to keep every segment (useful for the 3-bucket Devices
   *  breakdown where there's no long tail to collapse). */
  topN?: number
  /** Optional sort order to apply to segment names so colours stay stable
   *  across rows when one row has more categories than another. */
  segmentOrder?: string[]
}

/**
 * Horizontal stacked-bar chart for share-of-traffic comparison. Each row's
 * bar normalises to 100% of its own row total — comparing share, not absolute
 * volume. Colours assigned to segment *names* (not positions) so each
 * category renders in the same colour across every row.
 */
export function ShareBarChart({ rows, topN = 6, segmentOrder }: Props) {
  if (rows.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        No data to chart yet.
      </div>
    )
  }

  // Build a stable colour map for segment names. Discover the union of all
  // segment names across rows (post top-N capping); assign palette colours
  // by ordered appearance so the same name always gets the same colour.
  const cappedRows = rows.map((r) => capTopN(r, topN))
  const allNames = collectNames(cappedRows, segmentOrder)
  const colourFor = (name: string): string => {
    if (name === OTHER_LABEL) return SEGMENT_PALETTE[SEGMENT_PALETTE.length - 1]
    const i = allNames.indexOf(name)
    return SEGMENT_PALETTE[i % (SEGMENT_PALETTE.length - 1)]
  }

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        {cappedRows.map((row) => {
          const total = row.segments.reduce((s, x) => s + x.value, 0) || 1
          return (
            <div
              key={row.label}
              className="grid grid-cols-[140px_minmax(0,1fr)] gap-2 items-center"
            >
              <span className="text-xs truncate" title={row.label}>
                {row.label}
              </span>
              <div className="flex h-5 rounded-sm overflow-hidden bg-muted">
                {row.segments.map((seg) => {
                  const pct = (seg.value / total) * 100
                  if (pct < 0.5) return null // skip slivers below 0.5%
                  return (
                    <div
                      key={seg.name}
                      title={`${seg.name}: ${formatInteger(seg.value)} (${pct.toFixed(1)}%)`}
                      style={{
                        width: `${pct}%`,
                        backgroundColor: colourFor(seg.name),
                      }}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend along the bottom: one chip per distinct segment name across
          all rows, ordered for readability. */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground pt-2 border-t">
        {allNames.map((name) => (
          <span key={name} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block w-2 h-2 rounded-sm"
              style={{ backgroundColor: colourFor(name) }}
            />
            {name}
          </span>
        ))}
      </div>
    </div>
  )
}

// Exported for unit tests; implementation detail otherwise.
export function capTopN(row: ShareRow, topN: number): ShareRow {
  if (!Number.isFinite(topN) || row.segments.length <= topN) return row
  const sorted = [...row.segments].sort((a, b) => b.value - a.value)
  const top = sorted.slice(0, topN)
  const rest = sorted.slice(topN)
  const other = rest.reduce((s, x) => s + x.value, 0)
  if (other === 0) return { label: row.label, segments: top }
  return {
    label: row.label,
    segments: [...top, { name: OTHER_LABEL, value: other }],
  }
}

export function collectNames(rows: ShareRow[], preferredOrder?: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  // Use preferredOrder first if supplied so colour assignment is stable.
  for (const n of preferredOrder ?? []) {
    if (!seen.has(n)) {
      seen.add(n)
      out.push(n)
    }
  }
  for (const r of rows) {
    for (const s of r.segments) {
      if (!seen.has(s.name)) {
        seen.add(s.name)
        out.push(s.name)
      }
    }
  }
  // "Other" always last in the legend regardless of insertion order.
  if (seen.has(OTHER_LABEL)) {
    return [...out.filter((n) => n !== OTHER_LABEL), OTHER_LABEL]
  }
  return out
}
