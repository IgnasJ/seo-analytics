// Pure aggregation helpers over a list of completed Audit rows. Used by the
// /audit summary card and the /domain/[id] Audits tab. Everything here works
// off parsed AuditResult JSON — callers JSON.parse upstream so this layer
// stays free of DB or storage concerns.

import type { Audit, AuditResult, AuditCategory } from "@/types/audit"

export interface AuditKpis {
  /** Total completed audits in scope. */
  total: number
  /** Mean Performance score, integer 0..100. Null when there are no audits. */
  avgPerformance: number | null
  /** Mean SEO score, integer 0..100. Null when there are no audits. */
  avgSeo: number | null
  /** Mean Accessibility score, integer 0..100. */
  avgAccessibility: number | null
  /** Mean Best Practices score, integer 0..100. */
  avgBestPractices: number | null
  /** Count of audits where at least one of the four categories scored < 50. */
  failingAudits: number
}

export interface WorstPageRow {
  url: string
  performance: number
  seo: number
  /** A simple weighted score for sorting: average across the four categories
   *  so a page that's bad in one area but fine elsewhere doesn't dominate. */
  overall: number
  /** Unix timestamp of the audit this row reflects (the most recent for the URL). */
  requestedAt: number
}

export interface CommonFailureRow {
  /** Audit identifier from Lighthouse (e.g. "color-contrast", "image-alt"). */
  id: string
  /** Lighthouse's human-readable title for the audit. */
  title: string
  /** Most common category for this audit ID (in case the same ID appears
   *  under different categories — defensive; not currently the case). */
  category: AuditCategory
  /** Number of distinct URLs where this audit failed. Sort key. */
  urlsAffected: number
}

export interface AuditSummary {
  kpis: AuditKpis
  worstPages: WorstPageRow[]
  commonFailures: CommonFailureRow[]
}

interface ParsedAudit {
  audit: Audit
  result: AuditResult
}

/**
 * Walk the audit rows, JSON-parse `result_json` once each, and emit:
 *  - aggregate KPIs across the window,
 *  - worst pages (one row per URL, latest result per URL, sorted by overall ASC),
 *  - common failures (audit-id frequency across distinct URLs, DESC).
 *
 * Skips rows whose status ≠ "done" or whose `result_json` doesn't parse —
 * pending/error rows shouldn't pollute the averages.
 */
export function summariseAudits(
  rows: Audit[],
  opts: { topN?: number } = {}
): AuditSummary {
  const topN = opts.topN ?? 5

  const parsed: ParsedAudit[] = []
  for (const a of rows) {
    if (a.status !== "done" || !a.result_json) continue
    try {
      const result = JSON.parse(a.result_json) as AuditResult
      parsed.push({ audit: a, result })
    } catch {
      // Malformed result_json on an audit row — defensive skip rather than
      // crashing the whole summary card.
      continue
    }
  }

  return {
    kpis: computeKpis(parsed),
    worstPages: computeWorstPages(parsed, topN),
    commonFailures: computeCommonFailures(parsed, topN),
  }
}

function computeKpis(parsed: ParsedAudit[]): AuditKpis {
  if (parsed.length === 0) {
    return {
      total: 0,
      avgPerformance: null,
      avgSeo: null,
      avgAccessibility: null,
      avgBestPractices: null,
      failingAudits: 0,
    }
  }
  let sumP = 0
  let sumS = 0
  let sumA = 0
  let sumBP = 0
  let failing = 0
  for (const p of parsed) {
    sumP += p.result.scores.performance
    sumS += p.result.scores.seo
    sumA += p.result.scores.accessibility
    sumBP += p.result.scores.bestPractices
    if (
      p.result.scores.performance < 50 ||
      p.result.scores.seo < 50 ||
      p.result.scores.accessibility < 50 ||
      p.result.scores.bestPractices < 50
    ) {
      failing++
    }
  }
  return {
    total: parsed.length,
    avgPerformance: Math.round(sumP / parsed.length),
    avgSeo: Math.round(sumS / parsed.length),
    avgAccessibility: Math.round(sumA / parsed.length),
    avgBestPractices: Math.round(sumBP / parsed.length),
    failingAudits: failing,
  }
}

function computeWorstPages(parsed: ParsedAudit[], topN: number): WorstPageRow[] {
  // Keep the *latest* audit per URL — auditing the same URL twice shouldn't
  // double-count it in the "worst pages" list.
  const latestByUrl = new Map<string, ParsedAudit>()
  for (const p of parsed) {
    const prev = latestByUrl.get(p.audit.url)
    if (!prev || p.audit.requested_at > prev.audit.requested_at) {
      latestByUrl.set(p.audit.url, p)
    }
  }
  const rows: WorstPageRow[] = []
  for (const p of latestByUrl.values()) {
    const s = p.result.scores
    rows.push({
      url: p.audit.url,
      performance: s.performance,
      seo: s.seo,
      overall: Math.round(
        (s.performance + s.seo + s.accessibility + s.bestPractices) / 4
      ),
      requestedAt: p.audit.requested_at,
    })
  }
  rows.sort((a, b) => a.overall - b.overall)
  return rows.slice(0, topN)
}

function computeCommonFailures(
  parsed: ParsedAudit[],
  topN: number
): CommonFailureRow[] {
  // Use the latest audit per URL so re-audits don't multiply a failure's count.
  // Then walk the failing entries and count distinct URLs per audit id.
  const latestByUrl = new Map<string, ParsedAudit>()
  for (const p of parsed) {
    const prev = latestByUrl.get(p.audit.url)
    if (!prev || p.audit.requested_at > prev.audit.requested_at) {
      latestByUrl.set(p.audit.url, p)
    }
  }
  interface Accum {
    title: string
    category: AuditCategory
    urls: Set<string>
  }
  const byId = new Map<string, Accum>()
  for (const p of latestByUrl.values()) {
    for (const entry of p.result.audits) {
      if (entry.severity !== "fail") continue
      let acc = byId.get(entry.id)
      if (!acc) {
        acc = {
          title: entry.title,
          category: entry.category,
          urls: new Set(),
        }
        byId.set(entry.id, acc)
      }
      acc.urls.add(p.audit.url)
    }
  }
  const rows: CommonFailureRow[] = []
  for (const [id, acc] of byId.entries()) {
    rows.push({
      id,
      title: acc.title,
      category: acc.category,
      urlsAffected: acc.urls.size,
    })
  }
  rows.sort((a, b) => b.urlsAffected - a.urlsAffected || a.title.localeCompare(b.title))
  return rows.slice(0, topN)
}
