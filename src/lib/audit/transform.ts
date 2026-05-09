import type {
  AuditCategory,
  AuditEntry,
  AuditResult,
  AuditSeverity,
  CwvFieldMetric,
} from "@/types/audit"
import type { RawCruxMetric, RawPSIResponse } from "./psi"

const CATEGORY_KEY_MAP: Record<string, AuditCategory> = {
  performance: "performance",
  accessibility: "accessibility",
  "best-practices": "best-practices",
  seo: "seo",
}

function severityFromScore(score: number | null): AuditSeverity {
  if (score === null) return "warn"
  if (score >= 0.9) return "pass"
  if (score >= 0.5) return "warn"
  return "fail"
}

function asPct(score: number | null | undefined): number {
  if (typeof score !== "number") return 0
  return Math.round(score * 100)
}

function fieldMetricFromCrux(m: RawCruxMetric | undefined): CwvFieldMetric | null {
  if (!m?.distributions || m.distributions.length < 3) return null
  return {
    good: Math.round((m.distributions[0]?.proportion ?? 0) * 100),
    needsImprovement: Math.round((m.distributions[1]?.proportion ?? 0) * 100),
    poor: Math.round((m.distributions[2]?.proportion ?? 0) * 100),
  }
}

/**
 * Transform PSI's nested response into the flat AuditResult shape used by the
 * UI and by the diff renderer.
 */
export function transformPsi(raw: RawPSIResponse): AuditResult {
  const lh = raw.lighthouseResult ?? {}
  const cats = lh.categories ?? {}
  const audits = lh.audits ?? {}

  // Flatten audit entries, tagged with their category.
  const entries: AuditEntry[] = []
  for (const [catKey, catBlock] of Object.entries(cats)) {
    const category = CATEGORY_KEY_MAP[catKey]
    if (!category) continue
    for (const ref of catBlock.auditRefs ?? []) {
      const a = audits[ref.id]
      if (!a) continue
      // Skip "manual" / "notApplicable" / "informative" passes that have no
      // actionable score - they clutter the report.
      if (a.scoreDisplayMode === "manual" || a.scoreDisplayMode === "notApplicable") continue
      const score = a.score ?? null
      entries.push({
        id: a.id ?? ref.id,
        title: a.title ?? ref.id,
        description: a.description ?? "",
        score,
        displayValue: a.displayValue,
        category,
        severity: severityFromScore(score),
      })
    }
  }

  // Lab CWV — pulled from Lighthouse audits.
  const labCwv = {
    lcp: audits["largest-contentful-paint"]?.numericValue ?? null,
    cls: audits["cumulative-layout-shift"]?.numericValue ?? null,
    tbt: audits["total-blocking-time"]?.numericValue ?? null,
    fcp: audits["first-contentful-paint"]?.numericValue ?? null,
    si: audits["speed-index"]?.numericValue ?? null,
  }

  // Field CWV — from CrUX (loadingExperience).
  const cruxMetrics = raw.loadingExperience?.metrics ?? {}
  const fieldCwv = {
    lcp: fieldMetricFromCrux(cruxMetrics.LARGEST_CONTENTFUL_PAINT_MS),
    cls: fieldMetricFromCrux(cruxMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE),
    inp: fieldMetricFromCrux(cruxMetrics.INTERACTION_TO_NEXT_PAINT),
  }

  return {
    fetchedUrl: lh.requestedUrl ?? "",
    finalUrl: lh.finalDisplayedUrl ?? lh.finalUrl ?? lh.requestedUrl ?? "",
    scores: {
      performance: asPct(cats.performance?.score),
      accessibility: asPct(cats.accessibility?.score),
      bestPractices: asPct(cats["best-practices"]?.score),
      seo: asPct(cats.seo?.score),
    },
    labCwv,
    fieldCwv,
    audits: entries,
  }
}
