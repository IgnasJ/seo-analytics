export interface KeywordContext {
  query: string
  position: number
  impressions: number
  ctr: number
  selected: boolean
}

export interface LighthouseContext {
  performance: number
  seo: number
  lcp: number
  cls: number
  tbt: number
  failingAudits: string[]
  auditAge: string
}

export interface PageContext {
  title: string | null
  h1: string | null
  metaDescription: string | null
}

export interface GuideContext {
  url: string
  query: string
  keywords: KeywordContext[]
  lighthouse: LighthouseContext | null
  page: PageContext | null
}

export const DEFAULT_SYSTEM_PROMPT = `You are an SEO expert. Given a page's Search Console data, Lighthouse audit results, and live page content, produce a prioritised improvement guide.

First, group all the provided keywords by search intent. Identify which keywords are best served by optimising the existing page versus creating a new dedicated page.

Output two sections using these exact headers:
## OPTIMIZE THIS PAGE
## CREATE NEW PAGES

Under OPTIMIZE THIS PAGE, list numbered steps. Each step must follow this format:
<action text> | Forecast: <specific metric impact>

Under CREATE NEW PAGES, list numbered items. Each must follow this format:
<keyword> — <suggested article title> | Forecast: <traffic opportunity>

Rules:
- 4–7 steps per section maximum (omit a section entirely if empty)
- Reference specific numbers from the data provided (position, LCP value, CTR gap, failing audit names)
- Order each section by highest estimated impact first
- No intro sentence, no conclusion paragraph, no extra markdown`

export function buildUserPrompt(ctx: GuideContext): string {
  const kwList = ctx.keywords
    .map((k, i) => {
      const sel = k.selected ? " [SELECTED]" : ""
      return `${i + 1}. "${k.query}" — pos ${k.position.toFixed(1)}, ${k.impressions.toLocaleString()} impr, ${(k.ctr * 100).toFixed(2)}% CTR${sel}`
    })
    .join("\n")

  const lh = ctx.lighthouse
  const lhLine = lh
    ? `Lighthouse (${lh.auditAge}): Performance ${lh.performance}, SEO ${lh.seo}, LCP ${lh.lcp}s, CLS ${lh.cls}, TBT ${lh.tbt}ms\nFailing audits: ${lh.failingAudits.join(", ") || "none"}`
    : "Lighthouse: UNAVAILABLE"

  const pg = ctx.page
  const pgLine = pg
    ? `Page (live fetch): Title "${pg.title ?? "UNAVAILABLE"}", H1 "${pg.h1 ?? "UNAVAILABLE"}", meta description: ${pg.metaDescription ?? "MISSING"}`
    : "Page (live fetch): UNAVAILABLE"

  return [
    `URL: ${ctx.url}`,
    `Target query: "${ctx.query}"`,
    ``,
    `All keywords ranking for this URL (GSC, last 30d):`,
    kwList,
    ``,
    lhLine,
    ``,
    pgLine,
    ``,
    `Produce the improvement guide.`,
  ].join("\n")
}
