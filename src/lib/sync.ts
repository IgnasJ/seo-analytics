import { getDb } from "@/lib/db"
import type { Database } from "@/lib/db/driver"
import { listDomains, getDomain } from "@/lib/db/queries/domains"
import { getToken } from "@/lib/db/queries/tokens"
import { setAnalyticsCache, setGscCache, setIssuesCache, getLastSyncedAt, recordSync } from "@/lib/db/queries/cache"
import { getValidAccessToken } from "@/lib/google/oauth"
import { fetchGA4Report } from "@/lib/google/analytics"
import { fetchGSCReport, fetchSitemaps, fetchCrUX } from "@/lib/google/search-console"

// Ordered so the dashboard's primary ranges (7d, 1m) are fetched first — each
// range is written to cache as it lands, so the most-viewed data is fresh
// soonest. Remaining ranges follow; their order is otherwise immaterial.
const DATE_RANGES = [
  { key: "7d", startDate: () => formatDate(daysAgo(7)), endDate: () => formatDate(new Date()) },
  { key: "1m", startDate: () => formatDate(daysAgo(30)), endDate: () => formatDate(new Date()) },
  { key: "today", startDate: () => formatDate(new Date()), endDate: () => formatDate(new Date()) },
  { key: "yesterday", startDate: () => formatDate(daysAgo(1)), endDate: () => formatDate(daysAgo(1)) },
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

type FailureSink = (stage: string, err: unknown) => void

// In-flight per-domain syncs. A second request for a domain that's already
// syncing joins the running promise instead of launching duplicate API work —
// covers double-clicks and a manual "sync now" overlapping with "sync all".
const inFlightDomainSyncs = new Map<number, Promise<void>>()

export function syncDomain(domainId: number): Promise<void> {
  const existing = inFlightDomainSyncs.get(domainId)
  if (existing) return existing
  const run = runDomainSync(domainId).finally(() => {
    inFlightDomainSyncs.delete(domainId)
  })
  inFlightDomainSyncs.set(domainId, run)
  return run
}

async function runDomainSync(domainId: number): Promise<void> {
  const db = getDb()
  const domain = getDomain(db, domainId)
  if (!domain) throw new Error(`Domain ${domainId} not found`)

  const tokenRow = getToken(db)
  if (!tokenRow) throw new Error("No OAuth token — connect Google account first")

  const accessToken = await getValidAccessToken(tokenRow.refresh_token_encrypted)

  // Each stage catches its own errors so one failure (e.g. a GSC 403 when the
  // account isn't a verified Search Console owner) never drops data another
  // stage pulled successfully. Failures collect a stage label + message for the
  // summary / UI. Pushes are safe to share across the concurrent stages below —
  // the event loop is single-threaded, so they never interleave mid-push.
  const failures: { stage: string; message: string }[] = []
  const recordFailure: FailureSink = (stage, err) => {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[${stage}] ${domain.hostname}:`, message)
    failures.push({ stage, message })
  }

  // GA4, GSC and the sitemap/CrUX "issues" stage hit independent APIs, so we
  // run them concurrently to shorten the overall request (wall-clock ≈ the
  // slowest stage rather than their sum). Each stage still serialises its own
  // per-range calls internally: GA4 disallows concurrent requests per property,
  // and we keep GSC under its QPS ceiling.
  await Promise.all([
    domain.ga4_property_id
      ? syncGa4Stage(db, domainId, domain.ga4_property_id, accessToken, recordFailure)
      : Promise.resolve(),
    domain.gsc_site_url
      ? syncGscStage(db, domainId, domain.gsc_site_url, accessToken, recordFailure)
      : Promise.resolve(),
    domain.gsc_site_url
      ? syncIssuesStage(db, domainId, domain.gsc_site_url, accessToken, recordFailure)
      : Promise.resolve(),
  ])

  if (failures.length > 0) {
    // Group identical messages so a 403 hitting all 6 GSC ranges renders as
    // "GSC today, GSC yesterday, … (7 stages): User does not have…".
    const summary = summariseFailures(failures)
    recordSync(db, domainId, "error", summary)
    throw new Error(`${domain.hostname}: ${summary}`)
  }
  recordSync(db, domainId, "success")
}

/**
 * GA4 sessions/overview for every tracked date range. Sequential with a small
 * inter-call delay — GA4 rejects concurrent requests to the same property.
 */
async function syncGa4Stage(
  db: Database,
  domainId: number,
  propertyId: string,
  accessToken: string,
  recordFailure: FailureSink
): Promise<void> {
  for (let i = 0; i < DATE_RANGES.length; i++) {
    if (i > 0) await sleep(API_CALL_DELAY_MS)
    const range = DATE_RANGES[i]
    try {
      const data = await fetchGA4Report(
        propertyId,
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

/**
 * GSC search-analytics for every tracked date range. Sequential with a small
 * inter-call delay to stay under the QPS ceiling.
 */
async function syncGscStage(
  db: Database,
  domainId: number,
  siteUrl: string,
  accessToken: string,
  recordFailure: FailureSink
): Promise<void> {
  for (let i = 0; i < DATE_RANGES.length; i++) {
    if (i > 0) await sleep(API_CALL_DELAY_MS)
    const range = DATE_RANGES[i]
    try {
      const data = await fetchGSCReport(
        siteUrl,
        accessToken,
        range.startDate(),
        range.endDate()
      )
      setGscCache(db, domainId, range.key, data)
    } catch (err) {
      recordFailure(`GSC ${range.key}`, err)
    }
  }
}

/**
 * Sitemaps + CrUX field data → issues cache. Independent of the range loops,
 * so it runs alongside them.
 */
async function syncIssuesStage(
  db: Database,
  domainId: number,
  siteUrl: string,
  accessToken: string,
  recordFailure: FailureSink
): Promise<void> {
  try {
    const [sitemaps, cwv] = await Promise.all([
      fetchSitemaps(siteUrl, accessToken),
      fetchCrUX(
        siteUrl.startsWith("sc-domain:")
          ? `https://${siteUrl.replace("sc-domain:", "")}`
          : siteUrl,
        process.env.CRUX_API_KEY ?? ""
      ),
    ])
    setIssuesCache(db, domainId, { sitemaps, cwv })
  } catch (err) {
    recordFailure("issues", err)
  }
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
