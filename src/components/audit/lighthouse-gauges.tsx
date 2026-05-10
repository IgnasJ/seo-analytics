import type { AuditResult } from "@/types/audit"

interface GaugeProps {
  label: string
  /** Plain-language explanation; rendered as a `title` tooltip on hover. */
  tooltip: string
  score: number // 0..100
  delta?: number | null
}

function colourFor(score: number): { ring: string; text: string } {
  if (score >= 90) return { ring: "stroke-green-500", text: "text-green-600" }
  if (score >= 50) return { ring: "stroke-amber-500", text: "text-amber-600" }
  return { ring: "stroke-red-500", text: "text-red-600" }
}

function Gauge({ label, tooltip, score, delta }: GaugeProps) {
  const { ring, text } = colourFor(score)
  // Circle math: stroke-dasharray = circumference; stroke-dashoffset = unfilled portion
  const radius = 36
  const circ = 2 * Math.PI * radius
  const offset = circ * (1 - score / 100)

  return (
    <div className="flex flex-col items-center">
      {/* Fixed-size square wrapper holds the SVG ring AND the centered score
          so the numeric label is always perfectly centered regardless of
          digit count. Avoids the previous negative-margin hack. */}
      <div className="relative w-24 h-24" title={tooltip}>
        <svg
          viewBox="0 0 96 96"
          className="absolute inset-0 -rotate-90 w-full h-full"
        >
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
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-2xl font-semibold ${text}`}>{score}</span>
        </div>
      </div>

      {/* Label + delta: delta line is always rendered (with empty content when
          there's no prior audit) so all four columns have identical heights
          and the gauges line up across the row. */}
      <span
        title={tooltip}
        className="mt-3 text-xs uppercase tracking-wide text-muted-foreground cursor-help text-center"
      >
        {label}
      </span>
      <span
        className={
          "text-xs font-medium h-4 leading-4 " +
          (typeof delta !== "number"
            ? "text-transparent"
            : delta > 0
              ? "text-green-600"
              : delta < 0
                ? "text-red-600"
                : "text-muted-foreground")
        }
      >
        {typeof delta === "number"
          ? `${delta > 0 ? "+" : ""}${delta} vs prior`
          : "—"}
      </span>
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
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 items-start">
      <Gauge
        label="Performance"
        tooltip="Performance — how fast the page loads and renders. Built from lab Core Web Vitals (LCP, CLS, TBT, FCP, SI)."
        score={current.scores.performance}
        delta={delta("performance")}
      />
      <Gauge
        label="Accessibility"
        tooltip="Accessibility — automatable a11y checks: ARIA usage, semantic HTML, color contrast, focus order, image alt text. Manual audits still required for full coverage."
        score={current.scores.accessibility}
        delta={delta("accessibility")}
      />
      <Gauge
        label="Best practices"
        tooltip="Best Practices — modern web platform usage: HTTPS, no console errors, valid HTML, no deprecated APIs, secure third-party scripts."
        score={current.scores.bestPractices}
        delta={delta("bestPractices")}
      />
      <Gauge
        label="SEO"
        tooltip="SEO — basic on-page indexability checks: title, meta description, mobile-friendly viewport, valid robots, structured data, descriptive link text."
        score={current.scores.seo}
        delta={delta("seo")}
      />
    </div>
  )
}
