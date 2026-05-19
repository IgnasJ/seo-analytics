import type { Database } from "@/lib/db/driver"
import type { GuideContext, KeywordContext, LighthouseContext, PageContext } from "./prompt"
import type { AuditResult } from "@/types/audit"
import type { GscReport } from "@/types/search-console"
import { getGscCache } from "@/lib/db/queries/cache"

async function fetchPageMeta(url: string): Promise<PageContext | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "SEO-Analytics-Bot/1.0" },
    })
    clearTimeout(timeout)
    const html = await res.text()

    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? null
    const h1 = html.match(/<h1[^>]*>([^<]*)<\/h1>/i)?.[1]?.trim() ?? null
    const metaDescription =
      html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1]?.trim() ??
      html.match(/<meta\s+content=["']([^"']*)["']\s+name=["']description["']/i)?.[1]?.trim() ??
      null

    return { title, h1, metaDescription }
  } catch {
    return null
  }
}

export async function assembleGuideContext(
  db: Database,
  domainId: number,
  url: string,
  query: string
): Promise<GuideContext> {
  // 1. GSC keywords for this URL
  const gscRaw = getGscCache(db, domainId, "1m")
  const gscReport = gscRaw as GscReport | null
  const urlKeywords: KeywordContext[] = (gscReport?.queryPages ?? [])
    .filter((qp) => qp.page === url)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 20)
    .map((qp) => ({
      query: qp.query,
      position: qp.position,
      impressions: qp.impressions,
      ctr: qp.ctr,
      selected: qp.query === query,
    }))

  // Ensure the selected query is included even if it's not in top 20
  if (!urlKeywords.some((k) => k.selected)) {
    urlKeywords.unshift({ query, position: 0, impressions: 0, ctr: 0, selected: true })
  }

  // 2. Latest Lighthouse audit
  let lighthouse: LighthouseContext | null = null
  try {
    const auditRow = db
      .query<{ result_json: string; requested_at: number }, [string]>(
        "SELECT result_json, requested_at FROM audits WHERE url = ? AND status = 'done' ORDER BY requested_at DESC LIMIT 1"
      )
      .get(url)
    if (auditRow?.result_json) {
      const result = JSON.parse(auditRow.result_json) as AuditResult
      const ageSeconds = Math.floor(Date.now() / 1000) - auditRow.requested_at
      const ageLabel =
        ageSeconds < 3600
          ? `${Math.round(ageSeconds / 60)}m ago`
          : ageSeconds < 86400
            ? `${Math.round(ageSeconds / 3600)}h ago`
            : `${Math.round(ageSeconds / 86400)}d ago`

      const failing = (result.audits ?? [])
        .filter((a) => a.score !== null && a.score < 0.9 && a.score > 0)
        .map((a) => a.id)
        .slice(0, 5)

      lighthouse = {
        performance: result.scores.performance,
        seo: result.scores.seo,
        lcp: result.labCwv?.lcp != null ? Math.round(result.labCwv.lcp) / 1000 : 0,
        cls: result.labCwv?.cls ?? 0,
        tbt: result.labCwv?.tbt != null ? Math.round(result.labCwv.tbt) : 0,
        failingAudits: failing,
        auditAge: ageLabel,
      }
    }
  } catch {
    // lighthouse stays null
  }

  // 3. Live page fetch
  const page = await fetchPageMeta(url)

  return { url, query, keywords: urlKeywords, lighthouse, page }
}
