import type { Database } from "../driver"

interface CacheRow {
  data_json: string
}

interface IssuesCacheRow {
  data_json: string
}

/**
 * Parse a JSON fragment SQLite extracted for us. `json_extract` yields NULL for
 * a missing path, which we surface as `undefined` so callers' `?? []` defaults
 * keep working.
 */
function parseFragment(text: string | null): unknown {
  if (text == null) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/**
 * Overview + daily series of a cached GSC report, without the bulky
 * topQueries / topPages / queryPages arrays.
 *
 * The dashboard and the analytics comparison page render every tracked domain
 * but only need these two fields. Loading the full report meant JSON.parsing
 * ~50-250 KB per domain per render; here SQLite walks the JSON natively and
 * hands back a couple of KB.
 */
export function getGscSummary(
  db: Database,
  domainId: number,
  dateRange: string
): { overview: unknown; daily: unknown } | null {
  const row = db
    .query<{ overview: string | null; daily: string | null }, [number, string]>(
      `SELECT json_extract(data_json, '$.overview') AS overview,
              json_extract(data_json, '$.daily') AS daily
         FROM gsc_cache
        WHERE domain_id = ? AND date_range = ? AND json_valid(data_json)`
    )
    .get(domainId, dateRange)
  if (!row) return null
  return { overview: parseFragment(row.overview), daily: parseFragment(row.daily) }
}

/**
 * A cached GA4 report minus `topPages` (up to 200 rows that only the domain
 * detail page reads). Same motivation as getGscSummary.
 */
export function getAnalyticsSummary(
  db: Database,
  domainId: number,
  dateRange: string
): unknown | null {
  const row = db
    .query<{ data: string | null }, [number, string]>(
      `SELECT json_remove(data_json, '$.topPages') AS data
         FROM analytics_cache
        WHERE domain_id = ? AND date_range = ? AND json_valid(data_json)`
    )
    .get(domainId, dateRange)
  if (!row?.data) return null
  return parseFragment(row.data) ?? null
}

/**
 * Timestamp + status of the most recent sync attempt for a domain in a single
 * indexed lookup (idx_sync_log_domain). Prefer this over calling
 * getLastSyncedAt and getLastSyncStatus separately.
 */
export function getLatestSync(
  db: Database,
  domainId: number
): { syncedAt: number; status: "success" | "error" } | null {
  const row = db
    .query<{ synced_at: number; status: "success" | "error" }, [number]>(
      "SELECT synced_at, status FROM sync_log WHERE domain_id = ? ORDER BY synced_at DESC, id DESC LIMIT 1"
    )
    .get(domainId)
  return row ? { syncedAt: row.synced_at, status: row.status } : null
}

export function getAnalyticsCache(db: Database, domainId: number, dateRange: string): unknown | null {
  const row = db
    .query<CacheRow, [number, string]>(
      "SELECT data_json FROM analytics_cache WHERE domain_id = ? AND date_range = ?"
    )
    .get(domainId, dateRange)
  return row ? JSON.parse(row.data_json) : null
}

export function setAnalyticsCache(db: Database, domainId: number, dateRange: string, data: unknown): void {
  db.run(
    `INSERT INTO analytics_cache (domain_id, date_range, data_json)
     VALUES (?, ?, ?)
     ON CONFLICT(domain_id, date_range) DO UPDATE SET data_json = excluded.data_json, synced_at = unixepoch()`,
    [domainId, dateRange, JSON.stringify(data)]
  )
}

export function getGscCache(db: Database, domainId: number, dateRange: string): unknown | null {
  const row = db
    .query<CacheRow, [number, string]>(
      "SELECT data_json FROM gsc_cache WHERE domain_id = ? AND date_range = ?"
    )
    .get(domainId, dateRange)
  return row ? JSON.parse(row.data_json) : null
}

export function setGscCache(db: Database, domainId: number, dateRange: string, data: unknown): void {
  db.run(
    `INSERT INTO gsc_cache (domain_id, date_range, data_json)
     VALUES (?, ?, ?)
     ON CONFLICT(domain_id, date_range) DO UPDATE SET data_json = excluded.data_json, synced_at = unixepoch()`,
    [domainId, dateRange, JSON.stringify(data)]
  )
}

export function getIssuesCache(db: Database, domainId: number): unknown | null {
  const row = db
    .query<IssuesCacheRow, [number]>("SELECT data_json FROM issues_cache WHERE domain_id = ?")
    .get(domainId)
  return row ? JSON.parse(row.data_json) : null
}

export function setIssuesCache(db: Database, domainId: number, data: unknown): void {
  db.run(
    `INSERT INTO issues_cache (domain_id, data_json)
     VALUES (?, ?)
     ON CONFLICT(domain_id) DO UPDATE SET data_json = excluded.data_json, synced_at = unixepoch()`,
    [domainId, JSON.stringify(data)]
  )
}

export function getLastSyncedAt(db: Database, domainId: number): number | null {
  const row = db
    .query<{ synced_at: number }, [number]>(
      "SELECT synced_at FROM sync_log WHERE domain_id = ? ORDER BY synced_at DESC, id DESC LIMIT 1"
    )
    .get(domainId)
  return row?.synced_at ?? null
}

/** Status of the most recent sync attempt for a domain, or null if none. */
export function getLastSyncStatus(
  db: Database,
  domainId: number
): "success" | "error" | null {
  const row = db
    .query<{ status: "success" | "error" }, [number]>(
      "SELECT status FROM sync_log WHERE domain_id = ? ORDER BY synced_at DESC, id DESC LIMIT 1"
    )
    .get(domainId)
  return row?.status ?? null
}

export function recordSync(
  db: Database,
  domainId: number,
  status: "success" | "error",
  errorMessage?: string
): void {
  db.run(
    "INSERT INTO sync_log (domain_id, status, error_message) VALUES (?, ?, ?)",
    [domainId, status, errorMessage ?? null]
  )
}
