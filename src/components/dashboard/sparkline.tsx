// Tiny SVG sparkline. No interactivity, no axis labels, no library — just a
// path drawn from the input values, scaled to fit a fixed pixel box. Used
// inline next to dashboard metrics to give an at-a-glance trend feel.

interface Props {
  values: number[]
  width?: number
  height?: number
  /** CSS color for the line stroke. The area uses the same color at 0.18 alpha. */
  className?: string
  /** Accessible label for screen readers. */
  ariaLabel?: string
}

export function Sparkline({
  values,
  width = 80,
  height = 22,
  className = "text-blue-500",
  ariaLabel,
}: Props) {
  // Empty / all-zero data: render a faint dashed baseline so the slot
  // doesn't visually "disappear" — important for grid alignment.
  const hasSignal = values.some((v) => v > 0)
  if (!hasSignal || values.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="text-muted-foreground"
        aria-label={ariaLabel}
        role="img"
      >
        <line
          x1={2}
          y1={height / 2}
          x2={width - 2}
          y2={height / 2}
          stroke="currentColor"
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.4}
        />
      </svg>
    )
  }

  // Auto-scale: pin the y-axis to [0, max] of the visible series. Don't
  // share scales across cards — small domains would render as flat lines
  // next to bigger ones.
  const max = Math.max(...values)
  const min = 0
  const span = max - min || 1

  // 1px padding at top/bottom so the line doesn't clip against the edges.
  const padTop = 1
  const usableH = height - padTop * 2

  const stepX = (width - 2) / (values.length - 1)
  const points = values.map((v, i) => {
    const x = 1 + i * stepX
    const y = padTop + usableH - ((v - min) / span) * usableH
    return [x, y] as const
  })

  // Build the SVG path. Two paths share the same line: one stroked (the
  // line), one filled (the area underneath, with low opacity).
  const linePath = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ")
  const areaPath =
    `M${points[0][0].toFixed(1)} ${(height - padTop).toFixed(1)} ` +
    points.map(([x, y]) => `L${x.toFixed(1)} ${y.toFixed(1)}`).join(" ") +
    ` L${points[points.length - 1][0].toFixed(1)} ${(height - padTop).toFixed(1)} Z`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-label={ariaLabel}
      role="img"
    >
      <path d={areaPath} fill="currentColor" opacity={0.18} />
      <path
        d={linePath}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
