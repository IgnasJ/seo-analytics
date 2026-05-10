import { describe, it, expect } from "vitest"
import { summariseAudits } from "../aggregates"
import type { Audit, AuditResult } from "@/types/audit"

function mkResult(opts: {
  performance?: number
  accessibility?: number
  bestPractices?: number
  seo?: number
  failingIds?: { id: string; title: string; category?: AuditResult["audits"][number]["category"] }[]
}): AuditResult {
  return {
    fetchedUrl: "https://x/",
    finalUrl: "https://x/",
    scores: {
      performance: opts.performance ?? 80,
      accessibility: opts.accessibility ?? 90,
      bestPractices: opts.bestPractices ?? 80,
      seo: opts.seo ?? 100,
    },
    labCwv: { lcp: null, cls: null, tbt: null, fcp: null, si: null },
    fieldCwv: { lcp: null, cls: null, inp: null },
    audits: (opts.failingIds ?? []).map((f, i) => ({
      id: f.id,
      title: f.title,
      description: "",
      score: 0,
      category: f.category ?? "performance",
      severity: "fail" as const,
      numericSavings: i * 100,
    })),
  }
}

function mkAudit(
  id: number,
  url: string,
  requested_at: number,
  result: AuditResult | null,
  status: Audit["status"] = "done"
): Audit {
  return {
    id,
    url,
    status,
    requested_at,
    completed_at: result ? requested_at + 30 : null,
    result_json: result ? JSON.stringify(result) : null,
    error_message: null,
    strategy: "mobile",
  }
}

describe("summariseAudits", () => {
  it("returns empty/null kpis for an empty list", () => {
    const s = summariseAudits([])
    expect(s.kpis.total).toBe(0)
    expect(s.kpis.avgPerformance).toBeNull()
    expect(s.worstPages).toEqual([])
    expect(s.commonFailures).toEqual([])
  })

  it("averages scores across done audits and counts failing audits", () => {
    const rows = [
      mkAudit(1, "https://a/", 100, mkResult({ performance: 30, seo: 100 })),
      mkAudit(2, "https://b/", 200, mkResult({ performance: 70, seo: 90 })),
      mkAudit(3, "https://c/", 300, mkResult({ performance: 100, seo: 100 })),
    ]
    const s = summariseAudits(rows)
    expect(s.kpis.total).toBe(3)
    // (30 + 70 + 100) / 3 = 66.67 → 67
    expect(s.kpis.avgPerformance).toBe(67)
    expect(s.kpis.avgSeo).toBe(97)
    // Row 1 has Performance 30 < 50 → counted as failing.
    expect(s.kpis.failingAudits).toBe(1)
  })

  it("ignores pending / error rows when rolling averages", () => {
    const rows = [
      mkAudit(1, "https://a/", 100, mkResult({ performance: 100 })),
      mkAudit(2, "https://b/", 200, null, "pending"),
      mkAudit(3, "https://c/", 300, null, "error"),
    ]
    const s = summariseAudits(rows)
    expect(s.kpis.total).toBe(1)
    expect(s.kpis.avgPerformance).toBe(100)
  })

  it("worstPages takes the latest audit per URL and sorts by overall ASC", () => {
    const rows = [
      // Two audits for /a — newest should be the one that counts.
      mkAudit(1, "https://x/a", 100, mkResult({ performance: 90, seo: 90 })),
      mkAudit(2, "https://x/a", 200, mkResult({ performance: 20, seo: 30 })),
      mkAudit(3, "https://x/b", 100, mkResult({ performance: 60, seo: 80 })),
      mkAudit(4, "https://x/c", 100, mkResult({ performance: 100, seo: 100 })),
    ]
    const s = summariseAudits(rows, { topN: 3 })
    expect(s.worstPages.length).toBe(3)
    // /a's overall = (20 + 30 + 90 + 80) / 4 = 55 (using defaults a11y=90 bp=80)
    expect(s.worstPages[0].url).toBe("https://x/a")
    expect(s.worstPages[0].performance).toBe(20)
    // /c (all 100s except defaults) has the highest overall — should be last.
    expect(s.worstPages[s.worstPages.length - 1].url).toBe("https://x/c")
  })

  it("commonFailures counts distinct URLs affected, not raw frequency", () => {
    const failA = {
      id: "image-alt",
      title: "Image alt missing",
      category: "seo" as const,
    }
    const failB = {
      id: "meta-description",
      title: "Meta description",
      category: "seo" as const,
    }
    const rows = [
      mkAudit(
        1,
        "https://x/a",
        100,
        mkResult({ failingIds: [failA, failB] })
      ),
      // Re-audit of /a — same failures. Should NOT bump the count above 1
      // for either id, because the URL is the same.
      mkAudit(
        2,
        "https://x/a",
        200,
        mkResult({ failingIds: [failA, failB] })
      ),
      mkAudit(3, "https://x/b", 100, mkResult({ failingIds: [failA] })),
    ]
    const s = summariseAudits(rows, { topN: 10 })
    const ia = s.commonFailures.find((f) => f.id === "image-alt")!
    expect(ia.urlsAffected).toBe(2) // /a, /b
    const md = s.commonFailures.find((f) => f.id === "meta-description")!
    expect(md.urlsAffected).toBe(1) // /a only
    // Sort order: most-affected first.
    expect(s.commonFailures[0].id).toBe("image-alt")
  })

  it("respects topN", () => {
    const rows = [
      mkAudit(1, "https://x/a", 100, mkResult({ performance: 10 })),
      mkAudit(2, "https://x/b", 100, mkResult({ performance: 20 })),
      mkAudit(3, "https://x/c", 100, mkResult({ performance: 30 })),
      mkAudit(4, "https://x/d", 100, mkResult({ performance: 40 })),
    ]
    const s = summariseAudits(rows, { topN: 2 })
    expect(s.worstPages.length).toBe(2)
    expect(s.worstPages[0].url).toBe("https://x/a")
    expect(s.worstPages[1].url).toBe("https://x/b")
  })

  it("skips audits whose result_json fails to parse", () => {
    const broken = mkAudit(1, "https://a/", 100, mkResult({ performance: 80 }))
    broken.result_json = "not-json"
    const ok = mkAudit(2, "https://b/", 200, mkResult({ performance: 60 }))
    const s = summariseAudits([broken, ok])
    expect(s.kpis.total).toBe(1)
    expect(s.kpis.avgPerformance).toBe(60)
  })
})
