"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  CheckCircle2,
  XCircle,
  Loader2,
  GitCompareArrows,
} from "lucide-react"
import { AuditDetail } from "@/components/audit/audit-detail"
import { LighthouseGauges } from "@/components/audit/lighthouse-gauges"
import { Hint } from "@/components/ui/hint"
import { formatDateTime } from "@/lib/format"
import type { Audit, AuditResult, AuditStatus } from "@/types/audit"

/**
 * Single source of truth for the four Lighthouse score abbreviations used in
 * the pair-selector table header. Wrap each `<th>` in a <Hint> so the user
 * gets the expanded name on hover — same pattern as the score pills on
 * /audit's history rows.
 */
const SCORE_ABBREVS: { abbr: string; label: string; tooltip: string }[] = [
  {
    abbr: "P",
    label: "Performance",
    tooltip:
      "Performance score (0–100). Aggregated from lab Core Web Vitals — LCP, CLS, TBT, FCP, Speed Index.",
  },
  {
    abbr: "A",
    label: "Accessibility",
    tooltip:
      "Accessibility score (0–100). Automatable a11y checks: ARIA usage, semantic HTML, colour contrast, focus order, alt text.",
  },
  {
    abbr: "BP",
    label: "Best Practices",
    tooltip:
      "Best Practices score (0–100). Modern web platform usage: HTTPS, no console errors, valid HTML, no deprecated APIs.",
  },
  {
    abbr: "S",
    label: "SEO",
    tooltip:
      "SEO score (0–100). On-page indexability checks: title, meta description, mobile-friendly viewport, valid robots, structured data, descriptive link text.",
  },
]

type Severity = "all" | "fail" | "warn" | "pass"

interface Props {
  audits: Audit[]
  initialSeverity?: Severity
  initialA?: number | null
  initialB?: number | null
}

/**
 * Audit list with two checkbox columns (`A` / `B`) for picking any two audits
 * to diff. Default selection is the newest two done audits. Renders the diff
 * via the shared <AuditDetail> below.
 */
export function AuditPairCompare({
  audits,
  initialSeverity = "all",
  initialA = null,
  initialB = null,
}: Props) {
  // Pre-parse result_json once. Anything that isn't completed (no result_json)
  // can still appear in the list but isn't eligible for comparison.
  const parsed = useMemo(() => {
    const map = new Map<number, AuditResult>()
    for (const a of audits) {
      if (a.status === "done" && a.result_json) {
        try {
          map.set(a.id, JSON.parse(a.result_json) as AuditResult)
        } catch {
          // ignore parse errors — that audit just isn't comparable
        }
      }
    }
    return map
  }, [audits])

  const doneAudits = audits.filter((a) => parsed.has(a.id))

  // Default to newest two completed audits if the caller didn't supply explicit
  // selections. `initialA` is the OLDER audit (baseline); `initialB` is the
  // newer one we're comparing TO the baseline.
  const defaults = useMemo<{ a: number | null; b: number | null }>(() => {
    if (initialA && initialB) return { a: initialA, b: initialB }
    if (doneAudits.length === 0) return { a: null, b: null }
    if (doneAudits.length === 1) return { a: null, b: doneAudits[0].id }
    return { a: doneAudits[1].id, b: doneAudits[0].id }
  }, [doneAudits, initialA, initialB])

  const [a, setA] = useState<number | null>(defaults.a)
  const [b, setB] = useState<number | null>(defaults.b)
  const [severity, setSeverity] = useState<Severity>(initialSeverity)
  const [showCompare, setShowCompare] = useState(false)

  function toggleA(id: number) {
    setA((prev) => (prev === id ? null : id))
    // Don't auto-deselect from B — the user can have A and B as the same
    // value (which we'd treat as "no diff" but the UI doesn't need to
    // enforce; just disable the Compare button).
  }
  function toggleB(id: number) {
    setB((prev) => (prev === id ? null : id))
  }

  const canCompare = a !== null && b !== null && a !== b
  const currentResult = b !== null ? parsed.get(b) : undefined
  const priorResult = a !== null ? parsed.get(a) : undefined
  const currentAudit = b !== null ? audits.find((x) => x.id === b) : undefined
  const priorAudit = a !== null ? audits.find((x) => x.id === a) : undefined

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="overflow-x-auto -mx-3 sm:mx-0">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="px-2 py-1.5 text-center">
                  <Hint
                    text="Baseline audit. Selected pair is used by the diff renderer below as the 'before' state."
                    className="cursor-help"
                  >
                    A
                  </Hint>
                </th>
                <th className="px-2 py-1.5 text-center">
                  <Hint
                    text="Current audit. Selected pair is used by the diff renderer below as the 'after' state."
                    className="cursor-help"
                  >
                    B
                  </Hint>
                </th>
                <th className="px-2 py-1.5 text-left">When</th>
                <th className="px-2 py-1.5 text-left">Status</th>
                {SCORE_ABBREVS.map((s) => (
                  <th key={s.abbr} className="px-2 py-1.5 text-right">
                    <Hint text={s.tooltip} className="cursor-help">
                      {s.abbr}
                    </Hint>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {audits.map((au) => {
                const result = parsed.get(au.id)
                const disabled = !result
                return (
                  <tr key={au.id} className="border-b last:border-b-0">
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={a === au.id}
                        onChange={() => toggleA(au.id)}
                        disabled={disabled}
                        aria-label={`Select audit ${au.id} as baseline (A)`}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={b === au.id}
                        onChange={() => toggleB(au.id)}
                        disabled={disabled}
                        aria-label={`Select audit ${au.id} as current (B)`}
                      />
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap font-mono tabular-nums text-xs">
                      {formatDateTime(au.requested_at)}
                    </td>
                    <td className="px-2 py-1.5">
                      <StatusBadge status={au.status} />
                    </td>
                    <ScoreCell value={result?.scores.performance} />
                    <ScoreCell value={result?.scores.accessibility} />
                    <ScoreCell value={result?.scores.bestPractices} />
                    <ScoreCell value={result?.scores.seo} />
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => setShowCompare(true)}
            disabled={!canCompare}
          >
            <GitCompareArrows className="w-3.5 h-3.5 mr-1.5" />
            Compare A vs B
          </Button>
          {a !== null && b !== null && a === b && (
            <span className="text-xs text-amber-600">
              A and B point to the same audit — pick two different rows.
            </span>
          )}
          {!canCompare && a === null && b === null && (
            <span className="text-xs text-muted-foreground">
              Tick two rows to enable comparison.
            </span>
          )}
        </div>
      </div>

      {showCompare && currentResult && currentAudit && (
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-muted-foreground">
              Comparing{" "}
              <span className="font-mono">
                {priorAudit ? formatDateTime(priorAudit.requested_at) : "—"}
              </span>{" "}
              →{" "}
              <span className="font-mono">
                {formatDateTime(currentAudit.requested_at)}
              </span>
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowCompare(false)}
            >
              Hide
            </Button>
          </div>
          <LighthouseGauges
            current={currentResult}
            prior={priorResult ?? undefined}
          />
          <AuditDetail
            current={currentResult}
            prior={priorResult ?? undefined}
            severityFilter={severity}
            onSeverityFilterChange={setSeverity}
          />
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: AuditStatus }) {
  if (status === "pending" || status === "running") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" />
        {status}
      </span>
    )
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-600">
        <XCircle className="w-3 h-3" />
        error
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-green-600">
      <CheckCircle2 className="w-3 h-3" />
      done
    </span>
  )
}

function ScoreCell({ value }: { value?: number }) {
  if (typeof value !== "number") {
    return <td className="px-2 py-1.5 text-right text-muted-foreground tabular-nums">—</td>
  }
  const tone =
    value >= 90
      ? "text-green-600"
      : value >= 50
        ? "text-amber-600"
        : "text-red-600"
  return (
    <td className={`px-2 py-1.5 text-right tabular-nums font-medium ${tone}`}>
      {value}
    </td>
  )
}

// Tiny re-export so callers don't need to import Badge from this file.
export { Badge }
