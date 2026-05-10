import { ArrowDown, ArrowUp, Minus } from "lucide-react"

interface Props {
  current: number | null
  previous: number | null
  /**
   * Set true for metrics where a lower value is better (Position).
   * Drives the chip color: a downward move on a lower-is-better metric is
   * favourable (green), an upward move is unfavourable (red).
   */
  lowerIsBetter?: boolean
  /**
   * "absolute" — show the raw difference (e.g., "↑ 0.4").
   * "percent" — show the percentage change (e.g., "↑ 12%").
   */
  format?: "absolute" | "percent"
  /** Decimals for absolute format. Default 1. */
  decimals?: number
}

const NOISE_THRESHOLD_PCT = 2

export function TrendChip({
  current,
  previous,
  lowerIsBetter = false,
  format = "absolute",
  decimals = 1,
}: Props) {
  if (
    current === null ||
    previous === null ||
    !Number.isFinite(current) ||
    !Number.isFinite(previous) ||
    previous === 0
  ) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="w-3 h-3" />
      </span>
    )
  }

  const diff = current - previous
  const pct = (diff / previous) * 100

  // If the move is below the noise threshold, render flat regardless of
  // direction. Avoids "↑ 0.1%" spam.
  if (Math.abs(pct) < NOISE_THRESHOLD_PCT) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="w-3 h-3" />
        flat
      </span>
    )
  }

  const goingUp = diff > 0
  const favourable = lowerIsBetter ? !goingUp : goingUp
  const Icon = goingUp ? ArrowUp : ArrowDown
  const colour = favourable ? "text-green-600" : "text-red-600"
  const text =
    format === "percent"
      ? `${Math.abs(pct).toFixed(0)}%`
      : Math.abs(diff).toFixed(decimals)

  return (
    <span className={`inline-flex items-center gap-0.5 text-xs ${colour}`}>
      <Icon className="w-3 h-3" />
      {text}
    </span>
  )
}
