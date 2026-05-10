// Flat-keyed shape so a side-by-side diff between two AuditResult objects is
// trivially derivable without traversal-aware logic.

export type AuditCategory = "performance" | "accessibility" | "best-practices" | "seo"
export type AuditSeverity = "pass" | "warn" | "fail"

export interface CwvFieldMetric {
  good: number
  needsImprovement: number
  poor: number
}

export interface AuditEntry {
  id: string
  title: string
  description: string
  /** Lighthouse score 0..1, or null for informational audits. */
  score: number | null
  displayValue?: string
  category: AuditCategory
  severity: AuditSeverity
  /**
   * Estimated savings from Lighthouse's `details.overallSavingsMs` /
   * `details.overallSavingsBytes` — the "Potential 1.2 s saved" /
   * "Potential 84 KiB saved" pills you see in the Lighthouse UI. Null when
   * Lighthouse didn't quantify a saving for this audit. Unit is encoded in
   * `savingsUnit` so the renderer can pluralise correctly.
   */
  numericSavings: number | null
  savingsUnit?: "ms" | "bytes"
}

export interface AuditResult {
  fetchedUrl: string
  finalUrl: string
  scores: {
    performance: number  // 0..100
    accessibility: number
    bestPractices: number
    seo: number
  }
  labCwv: {
    lcp: number | null  // ms
    cls: number | null  // unit-less
    tbt: number | null  // ms
    fcp: number | null  // ms
    si: number | null   // ms
  }
  fieldCwv: {
    lcp: CwvFieldMetric | null
    cls: CwvFieldMetric | null
    inp: CwvFieldMetric | null
  }
  audits: AuditEntry[]
  /** Mobile vs desktop Lighthouse run. Defaults to "mobile" on legacy
   *  result_json rows that predate this field. */
  strategy?: "mobile" | "desktop"
  /** PSI's final-screenshot data-URL (PNG, base64). Null when the response
   *  didn't include one. Stored verbatim from `audits["final-screenshot"]`. */
  screenshot?: string | null
}

export type AuditStatus = "pending" | "running" | "done" | "error"

export type AuditStrategy = "mobile" | "desktop"

export interface Audit {
  id: number
  url: string
  status: AuditStatus
  requested_at: number
  completed_at: number | null
  result_json: string | null
  error_message: string | null
  /** "mobile" | "desktop" — defaulted by the schema so old rows return mobile. */
  strategy: AuditStrategy
}
