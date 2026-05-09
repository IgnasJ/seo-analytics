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
}

export type AuditStatus = "pending" | "running" | "done" | "error"

export interface Audit {
  id: number
  url: string
  status: AuditStatus
  requested_at: number
  completed_at: number | null
  result_json: string | null
  error_message: string | null
}
