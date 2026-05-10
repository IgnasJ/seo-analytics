import { describe, it, expect } from "vitest"
import { transformPsi } from "../transform"
import type { RawPSIResponse } from "../psi"

const fixture: RawPSIResponse = {
  loadingExperience: {
    metrics: {
      LARGEST_CONTENTFUL_PAINT_MS: {
        category: "FAST",
        distributions: [{ proportion: 0.8 }, { proportion: 0.15 }, { proportion: 0.05 }],
      },
      CUMULATIVE_LAYOUT_SHIFT_SCORE: {
        category: "FAST",
        distributions: [{ proportion: 0.9 }, { proportion: 0.07 }, { proportion: 0.03 }],
      },
    },
  },
  lighthouseResult: {
    requestedUrl: "https://example.com/",
    finalDisplayedUrl: "https://example.com/",
    categories: {
      performance: {
        id: "performance",
        score: 0.87,
        auditRefs: [
          { id: "largest-contentful-paint" },
          { id: "speed-index" },
          { id: "unused-css-rules" },
          { id: "uses-optimized-images" },
        ],
      },
      seo: {
        id: "seo",
        score: 1,
        auditRefs: [
          { id: "meta-description" },
          { id: "document-title" },
        ],
      },
      accessibility: { id: "accessibility", score: 0.94, auditRefs: [{ id: "image-alt" }] },
      "best-practices": { id: "best-practices", score: 0.5, auditRefs: [{ id: "csp-xss" }] },
    },
    audits: {
      "largest-contentful-paint": {
        id: "largest-contentful-paint",
        title: "Largest Contentful Paint",
        description: "...",
        score: 0.7,
        numericValue: 2400,
        displayValue: "2.4 s",
      },
      "speed-index": {
        id: "speed-index",
        title: "Speed Index",
        description: "...",
        score: 0.95,
        numericValue: 1800,
      },
      "meta-description": {
        id: "meta-description",
        title: "Document has a meta description",
        description: "...",
        score: 1,
      },
      "document-title": {
        id: "document-title",
        title: "Document has a <title> element",
        description: "...",
        score: 1,
      },
      "image-alt": {
        id: "image-alt",
        title: "Image elements have [alt] attributes",
        description: "...",
        score: null,
        scoreDisplayMode: "manual", // should be skipped
      },
      "csp-xss": {
        id: "csp-xss",
        title: "Content security policy",
        description: "...",
        score: 0.4,
      },
      "unused-css-rules": {
        id: "unused-css-rules",
        title: "Reduce unused CSS",
        description: "...",
        score: 0.2,
        details: { type: "opportunity", overallSavingsMs: 1500 },
      },
      "uses-optimized-images": {
        id: "uses-optimized-images",
        title: "Efficiently encode images",
        description: "...",
        score: 0.3,
        details: { type: "opportunity", overallSavingsBytes: 51200 },
      },
      "final-screenshot": {
        id: "final-screenshot",
        title: "Final screenshot",
        description: "",
        score: null,
        scoreDisplayMode: "informative",
        details: { type: "screenshot", data: "data:image/jpeg;base64,FAKE=" },
      },
    },
  },
}

describe("transformPsi", () => {
  it("flattens scores into 0-100 percentages", () => {
    const r = transformPsi(fixture)
    expect(r.scores.performance).toBe(87)
    expect(r.scores.seo).toBe(100)
    expect(r.scores.accessibility).toBe(94)
    expect(r.scores.bestPractices).toBe(50)
  })

  it("extracts lab CWV from Lighthouse audits", () => {
    const r = transformPsi(fixture)
    expect(r.labCwv.lcp).toBe(2400)
    expect(r.labCwv.si).toBe(1800)
    expect(r.labCwv.cls).toBeNull()
  })

  it("converts CrUX field metric distributions to good/needsImprovement/poor pcts", () => {
    const r = transformPsi(fixture)
    expect(r.fieldCwv.lcp).toEqual({ good: 80, needsImprovement: 15, poor: 5 })
    expect(r.fieldCwv.cls).toEqual({ good: 90, needsImprovement: 7, poor: 3 })
    expect(r.fieldCwv.inp).toBeNull()
  })

  it("classifies severity by score thresholds", () => {
    const r = transformPsi(fixture)
    const lcp = r.audits.find((a) => a.id === "largest-contentful-paint")!
    expect(lcp.severity).toBe("warn") // 0.7 -> warn
    const meta = r.audits.find((a) => a.id === "meta-description")!
    expect(meta.severity).toBe("pass") // 1 -> pass
    const csp = r.audits.find((a) => a.id === "csp-xss")!
    expect(csp.severity).toBe("fail") // 0.4 -> fail
  })

  it("skips manual / not-applicable audits", () => {
    const r = transformPsi(fixture)
    expect(r.audits.find((a) => a.id === "image-alt")).toBeUndefined()
  })

  it("tags each entry with its category", () => {
    const r = transformPsi(fixture)
    const lcp = r.audits.find((a) => a.id === "largest-contentful-paint")!
    expect(lcp.category).toBe("performance")
    const meta = r.audits.find((a) => a.id === "meta-description")!
    expect(meta.category).toBe("seo")
  })

  it("captures numericSavings (ms) from opportunity details", () => {
    const r = transformPsi(fixture)
    const e = r.audits.find((a) => a.id === "unused-css-rules")!
    expect(e.numericSavings).toBe(1500)
    expect(e.savingsUnit).toBe("ms")
  })

  it("captures numericSavings (bytes) from diagnostic details", () => {
    const r = transformPsi(fixture)
    const e = r.audits.find((a) => a.id === "uses-optimized-images")!
    expect(e.numericSavings).toBe(51200)
    expect(e.savingsUnit).toBe("bytes")
  })

  it("leaves numericSavings null when Lighthouse didn't quantify a saving", () => {
    const r = transformPsi(fixture)
    const e = r.audits.find((a) => a.id === "csp-xss")!
    expect(e.numericSavings).toBeNull()
    expect(e.savingsUnit).toBeUndefined()
  })

  it("captures the final-screenshot data URL onto the result", () => {
    const r = transformPsi(fixture)
    expect(r.screenshot).toBe("data:image/jpeg;base64,FAKE=")
  })

  it("threads the strategy argument through onto the result", () => {
    expect(transformPsi(fixture, "desktop").strategy).toBe("desktop")
    expect(transformPsi(fixture, "mobile").strategy).toBe("mobile")
    // Default arg is mobile so old callers keep working.
    expect(transformPsi(fixture).strategy).toBe("mobile")
  })
})
