import { describe, it, expect } from "vitest"
import { parseGuideMarkdown } from "../parse"

const SAMPLE = `
## OPTIMIZE THIS PAGE
1. Write a meta description under 155 chars | Forecast: CTR +1–2% → ~20–40 clicks/mo
2. Convert hero image to WebP | Forecast: LCP 3.8s → ~2.4s

## CREATE NEW PAGES
1. "best seo tools" — Best SEO Tools in 2025: Ranked | Forecast: 2,100 impr/mo opportunity
`

describe("parseGuideMarkdown", () => {
  it("parses both sections", () => {
    const result = parseGuideMarkdown(SAMPLE)
    expect(result.optimize).toHaveLength(2)
    expect(result.new_page).toHaveLength(1)
  })

  it("extracts text and forecast for optimize steps", () => {
    const result = parseGuideMarkdown(SAMPLE)
    expect(result.optimize[0].text).toBe("Write a meta description under 155 chars")
    expect(result.optimize[0].forecast).toBe("CTR +1–2% → ~20–40 clicks/mo")
    expect(result.optimize[1].text).toBe("Convert hero image to WebP")
    expect(result.optimize[1].forecast).toBe("LCP 3.8s → ~2.4s")
  })

  it("extracts text and forecast for new_page steps", () => {
    const result = parseGuideMarkdown(SAMPLE)
    expect(result.new_page[0].text).toBe('"best seo tools" — Best SEO Tools in 2025: Ranked')
    expect(result.new_page[0].forecast).toBe("2,100 impr/mo opportunity")
  })

  it("returns empty arrays when sections are absent", () => {
    const result = parseGuideMarkdown("## OPTIMIZE THIS PAGE\n1. Just a step | Forecast: x")
    expect(result.new_page).toHaveLength(0)
  })

  it("handles steps with no Forecast separator gracefully", () => {
    const result = parseGuideMarkdown("## OPTIMIZE THIS PAGE\n1. Do something without forecast")
    expect(result.optimize[0].text).toBe("Do something without forecast")
    expect(result.optimize[0].forecast).toBeNull()
  })

  it("assigns positions starting at 1", () => {
    const result = parseGuideMarkdown(SAMPLE)
    expect(result.optimize[0].position).toBe(1)
    expect(result.optimize[1].position).toBe(2)
    expect(result.new_page[0].position).toBe(1)
  })
})
