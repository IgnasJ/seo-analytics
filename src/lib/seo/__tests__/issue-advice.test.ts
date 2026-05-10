import { describe, it, expect } from "vitest"
import {
  assessLcp,
  assessCls,
  assessInp,
  assessSitemap,
  NO_SITEMAPS_INSIGHT,
} from "../issue-advice"
import type { CwvMetric, SitemapInfo } from "@/types/search-console"

function cwv(good: number, needs: number, poor: number): CwvMetric {
  return { good, needsImprovement: needs, poor }
}

describe("CWV severity classification", () => {
  it("returns ok when good % >= 75", () => {
    expect(assessLcp(cwv(80, 15, 5)).severity).toBe("ok")
    expect(assessCls(cwv(75, 20, 5)).severity).toBe("ok")
    expect(assessInp(cwv(90, 8, 2)).severity).toBe("ok")
  })

  it("returns warn when good % is 50–74", () => {
    expect(assessLcp(cwv(60, 30, 10)).severity).toBe("warn")
    expect(assessCls(cwv(50, 30, 20)).severity).toBe("warn")
  })

  it("returns critical when good % is below 50", () => {
    expect(assessLcp(cwv(30, 30, 40)).severity).toBe("critical")
    expect(assessInp(cwv(0, 50, 50)).severity).toBe("critical")
  })

  it("returns info with no-data diagnosis when metric is null", () => {
    const lcp = assessLcp(null)
    expect(lcp.severity).toBe("info")
    expect(lcp.diagnosis).toMatch(/no field/i)
    expect(lcp.fixes.length).toBeGreaterThan(0)
    expect(lcp.fixes.some((f) => /audit/i.test(f.title))).toBe(true)
  })
})

describe("metric-specific advice content", () => {
  it("LCP advice mentions image and TTFB fixes", () => {
    const r = assessLcp(cwv(40, 30, 30))
    const text = r.fixes.map((f) => f.title + " " + f.detail).join(" ")
    expect(text).toMatch(/image/i)
    expect(text).toMatch(/TTFB|response time/i)
  })

  it("CLS advice mentions image dimensions and font swap", () => {
    const r = assessCls(cwv(20, 30, 50))
    const text = r.fixes.map((f) => f.title + " " + f.detail).join(" ")
    expect(text).toMatch(/width.*height|image/i)
    expect(text).toMatch(/font|FOUT/i)
  })

  it("INP advice mentions main thread and third-party scripts", () => {
    const r = assessInp(cwv(20, 40, 40))
    const text = r.fixes.map((f) => f.title + " " + f.detail).join(" ")
    expect(text).toMatch(/main.thread|long task|third.party/i)
  })

  it("includes ordered fixes with impact tier", () => {
    const r = assessLcp(cwv(40, 30, 30))
    expect(r.fixes.length).toBeGreaterThan(2)
    for (const f of r.fixes) {
      expect(["high", "medium", "low"]).toContain(f.impact)
    }
  })
})

describe("sitemap assessment", () => {
  function sm(over: Partial<SitemapInfo> = {}): SitemapInfo {
    return {
      path: "sitemap.xml",
      submitted: 100,
      indexed: 100,
      errors: 0,
      warnings: 0,
      ...over,
    }
  }

  it("ok when no errors / warnings and full coverage", () => {
    const r = assessSitemap(sm())
    expect(r.severity).toBe("ok")
    expect(r.coverageRatio).toBe(1)
  })

  it("critical when errors > 0", () => {
    const r = assessSitemap(sm({ errors: 5 }))
    expect(r.severity).toBe("critical")
    expect(r.diagnosis).toMatch(/error/i)
    expect(r.fixes.some((f) => /search console|validate/i.test(f.title))).toBe(true)
  })

  it("warn when warnings > 0", () => {
    const r = assessSitemap(sm({ warnings: 3 }))
    expect(r.severity).toBe("warn")
  })

  it("warn on indexing gap (indexed/submitted < 0.7)", () => {
    const r = assessSitemap(sm({ submitted: 100, indexed: 60 }))
    expect(r.severity).toBe("warn")
    expect(r.diagnosis).toMatch(/indexing gap|not indexed/i)
    expect(r.fixes.some((f) => /Pages report|inspect/i.test(f.title))).toBe(true)
    expect(r.coverageRatio).toBeCloseTo(0.6, 2)
  })

  it("critical errors take precedence over coverage gap", () => {
    const r = assessSitemap(sm({ errors: 1, indexed: 30, submitted: 100 }))
    expect(r.severity).toBe("critical")
  })

  it("info when sitemap is empty", () => {
    const r = assessSitemap(sm({ submitted: 0, indexed: 0 }))
    expect(r.severity).toBe("info")
    expect(r.diagnosis).toMatch(/no submitted URLs/i)
  })
})

describe("NO_SITEMAPS_INSIGHT", () => {
  it("recommends generating and submitting a sitemap", () => {
    const text = NO_SITEMAPS_INSIGHT.fixes
      .map((f) => f.title + " " + f.detail)
      .join(" ")
    expect(text).toMatch(/generate.*sitemap|sitemap\.xml/i)
    expect(text).toMatch(/submit/i)
  })
})
