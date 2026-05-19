import { describe, it, expect } from "vitest"
import { buildUserPrompt, type GuideContext } from "../prompt"

const BASE_CTX: GuideContext = {
  url: "https://example.com/page",
  query: "how to improve landing page speed",
  keywords: [
    { query: "how to improve landing page speed", position: 7.2, impressions: 3400, ctr: 0.012, selected: true },
    { query: "reduce page load time", position: 14.1, impressions: 890, ctr: 0.006, selected: false },
  ],
  lighthouse: {
    performance: 58, seo: 71,
    lcp: 3.8, cls: 0.04, tbt: 340,
    failingAudits: ["render-blocking-resources", "uses-optimized-images"],
    auditAge: "2d ago",
  },
  page: {
    title: "Improve Page Speed | MyBlog",
    h1: "Make Your Pages Faster",
    metaDescription: null,
  },
}

describe("buildUserPrompt", () => {
  it("includes URL and selected query", () => {
    const prompt = buildUserPrompt(BASE_CTX)
    expect(prompt).toContain("https://example.com/page")
    expect(prompt).toContain("how to improve landing page speed")
  })

  it("marks the selected keyword with [SELECTED]", () => {
    const prompt = buildUserPrompt(BASE_CTX)
    expect(prompt).toContain("[SELECTED]")
  })

  it("includes lighthouse metrics", () => {
    const prompt = buildUserPrompt(BASE_CTX)
    expect(prompt).toContain("Performance 58")
    expect(prompt).toContain("LCP 3.8")
  })

  it("shows MISSING for null meta description", () => {
    const prompt = buildUserPrompt(BASE_CTX)
    expect(prompt).toContain("meta description: MISSING")
  })

  it("shows UNAVAILABLE when lighthouse is null", () => {
    const ctx = { ...BASE_CTX, lighthouse: null }
    const prompt = buildUserPrompt(ctx)
    expect(prompt).toContain("UNAVAILABLE")
  })
})
