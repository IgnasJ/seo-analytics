import { getDb } from "@/lib/db"
import { listDomains, getDomain } from "@/lib/db/queries/domains"
import { getToken } from "@/lib/db/queries/tokens"
import { setAnalyticsCache, setGscCache, setIssuesCache, getLastSyncedAt, recordSync } from "@/lib/db/queries/cache"
import { getValidAccessToken } from "@/lib/google/oauth"
import { fetchGA4Report } from "@/lib/google/analytics"
import { fetchGSCReport, fetchSitemaps, fetchCrUX } from "@/lib/google/search-console"

const DATE_RANGES = [
  { key: "today", startDate: () => formatDate(new Date()), endDate: () => formatDate(new Date()) },
  { key: "yesterday", startDate: () => formatDate(daysAgo(1)), endDate: () => formatDate(daysAgo(1)) },
  { key: "7d", startDate: () => formatDate(daysAgo(7)), endDate: () => formatDate(new Date()) },
  { key: "1m", startDate: () => formatDate(daysAgo(30)), endDate: () => formatDate(new Date()) },
  { key: "90d", startDate: () => formatDate(daysAgo(90)), endDate: () => formatDate(new Date()) },
  { key: "1y", startDate: () => formatDate(daysAgo(365)), endDate: () => formatDate(new Date()) },
]

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0]
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

const STALE_THRESHOLD_SECONDS = 24 * 60 * 60

export function isStale(lastSyncedAt: number | null): boolean {
  if (!lastSyncedAt) return true
  return Date.now() / 1000 - lastSyncedAt > STALE_THRESHOLD_SECONDS
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

// Minimum gap between consecutive API calls within a single domain sync.
// GSC allows ~20 QPS; GA4 disallows concurrent requests per property.
// 300 ms keeps us comfortably under both limits even when ranges pile up.
const API_CALL_DELAY_MS = 300

export async function syncDomain(domainId: number): Promise<void> {
  const db = getDb()
  const domain = getDomain(db, domainId)
  if (!domain) throw new Error(`Domain ${domainId} not found`)

  const tokenRow = getToken(db)
  if (!tokenRow) throw new Error("No OAuth token — connect Google account first")

  // We split the sync into independent stages and catch each one so a single
  // permission error (e.g. GSC 403 because the user isn't a Search Console
  // verified owner of the property) doesn't drop the GA4 data we successfully
  // pulled. Each failure stores both the stage label (for the summary) and
  // the underlying error message (so the UI can show it on click).
  const accessToken = await getValidAccessToken(tokenRow.refresh_token_encrypted)
  const failures: { stage: string; message: string }[] = []

  function recordFailure(stage: string, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[${stage}] ${domain!.hostname}:`, message)
    failures.push({ stage, message })
  }

  if (domain.ga4_property_id) {
    for (let i = 0; i < DATE_RANGES.length; i++) {
      if (i > 0) await sleep(API_CALL_DELAY_MS)
      const range = DATE_RANGES[i]
      try {
        const data = await fetchGA4Report(
          domain.ga4_property_id,
          accessToken,
          range.startDate(),
          range.endDate()
        )
        setAnalyticsCache(db, domainId, range.key, data)
      } catch (err) {
        recordFailure(`GA4 ${range.key}`, err)
      }
    }
  }

  if (domain.gsc_site_url) {
    for (let i = 0; i < DATE_RANGES.length; i++) {
      if (i > 0) await sleep(API_CALL_DELAY_MS)
      const range = DATE_RANGES[i]
      try {
        const data = await fetchGSCReport(
          domain.gsc_site_url,
          accessToken,
          range.startDate(),
          range.endDate()
        )
        setGscCache(db, domainId, range.key, data)
      } catch (err) {
        recordFailure(`GSC ${range.key}`, err)
      }
    }

    try {
      const [sitemaps, cwv] = await Promise.all([
        fetchSitemaps(domain.gsc_site_url, accessToken),
        fetchCrUX(
          domain.gsc_site_url.startsWith("sc-domain:")
            ? `https://${domain.gsc_site_url.replace("sc-domain:", "")}`
            : domain.gsc_site_url,
          process.env.CRUX_API_KEY ?? ""
        ),
      ])
      setIssuesCache(db, domainId, { sitemaps, cwv })
    } catch (err) {
      recordFailure("issues", err)
    }
  }

  if (failures.length > 0) {
    // Group identical messages so a 403 hitting all 6 GSC ranges renders as
    // "GSC today, GSC yesterday, … (7 stages): User does not have…".
    const summary = summariseFailures(failures)
    recordSync(db, domainId, "error", summary)
    throw new Error(`${domain.hostname}: ${summary}`)
  }
  recordSync(db, domainId, "success")
}

function summariseFailures(
  failures: { stage: string; message: string }[]
): string {
  // Group by message so repeated identical errors collapse into one entry.
  const byMessage = new Map<string, string[]>()
  for (const f of failures) {
    const list = byMessage.get(f.message) ?? []
    list.push(f.stage)
    byMessage.set(f.message, list)
  }
  return Array.from(byMessage.entries())
    .map(([msg, stages]) =>
      stages.length > 1
        ? `${stages.length} stages (${stages.join(", ")}): ${msg}`
        : `${stages[0]}: ${msg}`
    )
    .join("\n")
}

let startupSyncPromise: Promise<void> | null = null

export async function startupSync(): Promise<void> {
  if (startupSyncPromise) return startupSyncPromise
  startupSyncPromise = _runStartupSync().finally(() => {
    startupSyncPromise = null
  })
  return startupSyncPromise
}

async function _runStartupSync(): Promise<void> {
  const db = getDb()
  const domains = listDomains(db)
  for (const domain of domains) {
    const lastSync = getLastSyncedAt(db, domain.id)
    if (isStale(lastSync)) {
      await syncDomain(domain.id).catch(console.error)
    }
  }
}

/**
 * Force-sync every tracked domain regardless of cache staleness. Used by the
 * "Sync all" button on the settings page. Returns per-domain success / failure
 * so the UI can summarise. Sequential to keep API call rate under control.
 */
export async function syncAllDomains(): Promise<{
  total: number
  succeeded: number
  failed: { hostname: string; error: string }[]
}> {
  const db = getDb()
  const domains = listDomains(db)
  const failed: { hostname: string; error: string }[] = []
  let succeeded = 0
  for (const domain of domains) {
    try {
      await syncDomain(domain.id)
      succeeded++
    } catch (err) {
      failed.push({
        hostname: domain.hostname,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return { total: domains.length, succeeded, failed }
}
