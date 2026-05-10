"use client"

import { useCallback, useState } from "react"

/**
 * Shared state + helpers for charts that want hover-highlight and click-to-hide
 * behaviour on their legend, mirroring what MultiDomainLineChart does for the
 * Analytics page. Reusable by:
 *   - LineChart with N series (traffic-chart, gsc-chart)
 *   - PieChart with named slices (device-chart)
 *   - any chart with a legend whose entries are series names
 *
 * Pass the result of `legendFormatter(name)` to recharts' Legend.formatter so
 * hidden entries render strike-through + dimmed in the legend itself.
 */
export function useLegendVisibility() {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set())
  const [hovered, setHovered] = useState<string | null>(null)

  const toggle = useCallback((name: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

  const isHidden = useCallback((name: string) => hidden.has(name), [hidden])

  /**
   * Suitable for recharts' Legend.formatter prop. Renders the series name
   * with strike-through + opacity when it's been click-hidden.
   */
  const legendFormatter = useCallback(
    (value: unknown) => {
      if (typeof value !== "string") return value as React.ReactNode
      const isOff = hidden.has(value)
      return (
        <span
          style={{
            textDecoration: isOff ? "line-through" : "none",
            opacity: isOff ? 0.4 : 1,
          }}
        >
          {value}
        </span>
      )
    },
    [hidden]
  )

  return {
    /** Set of currently-hidden series names. */
    hidden,
    /** Whether a given series name is hidden. */
    isHidden,
    /** Currently-hovered legend entry name (or null). */
    hovered,
    setHovered,
    /** Toggle a series in/out of the hidden set. */
    toggle,
    /** Pass to recharts' Legend.formatter. */
    legendFormatter,
  }
}
