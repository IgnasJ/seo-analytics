import type { AuditResult } from "@/types/audit"

interface GaugeProps {
  label: string
  score: number  // 0..100
  delta?: number | null
}

function colourFor(score: number): { ring: string; text: string } {
  if (score >= 90) return { ring: "stroke-green-500", text: "text-green-600" }
  if (score >= 50) return { ring: "stroke-amber-500", text: "text-amber-600" }
  return { ring: "stroke-red-500", text: "text-red-600" }
}

function Gauge({ label, score, delta }: GaugeProps) {
  const { ring, text } = colourFor(score)
  // Circle math: stroke-dasharray = circumference; stroke-dashoffset = unfilled portion
  const radius = 36
  const circ = 2 * Math.PI * radius
  const offset = circ * (1 - score / 100)

  return (
    <div className="flex flex-col items-center">
      <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          strokeWidth="6"
          className="stroke-muted"
        />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className={ring}
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      <div className="-mt-[68px] flex flex-col items-center pointer-events-none">
        <span className={`text-2xl font-semibold ${text}`}>{score}</span>
      </div>
      <div className="mt-3 flex flex-col items-center">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {typeof delta === "number" && (
          <span
            className={
              "text-xs font-medium " +
              (delta > 0
                ? "text-green-600"
                : delta < 0
                  ? "text-red-600"
                  : "text-muted-foreground")
            }
          >
            {delta > 0 ? "+" : ""}
            {delta} vs prior
          </span>
        )}
      </div>
    </div>
  )
}

interface Props {
  current: AuditResult
  prior?: AuditResult
}

export function LighthouseGauges({ current, prior }: Props) {
  const delta = (key: keyof AuditResult["scores"]) =>
    prior ? current.scores[key] - prior.scores[key] : null
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 items-end">
      <Gauge
        label="Performance"
        score={current.scores.performance}
        delta={delta("performance")}
      />
      <Gauge
        label="Accessibility"
        score={current.scores.accessibility}
        delta={delta("accessibility")}
      />
      <Gauge
        label="Best practices"
        score={current.scores.bestPractices}
        delta={delta("bestPractices")}
      />
      <Gauge label="SEO" score={current.scores.seo} delta={delta("seo")} />
    </div>
  )
}
