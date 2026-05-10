import type { Database } from "../driver"

interface CacheRow {
  id: number
  domain_id: number
  date_range: string
  data_json: string
  synced_at: number
}

interface IssuesCacheRow {
  id: number
  domain_id: number
  data_json: string
  synced_at: number
}

export function getAnalyticsCache(db: Database, domainId: number, dateRange: string): unknown | null {
  const row = db
    .query<CacheRow, [number, string]>(
      "SELECT * FROM analytics_cache WHERE domain_id = ? AND date_range = ?"
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
      "SELECT * FROM gsc_cache WHERE domain_id = ? AND date_range = ?"
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
    .query<IssuesCacheRow, [number]>("SELECT * FROM issues_cache WHERE domain_id = ?")
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
      "SELECT synced_at FROM sync_log WHERE domain_id = ? ORDER BY synced_at DESC LIMIT 1"
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
      "SELECT status FROM sync_log WHERE domain_id = ? ORDER BY synced_at DESC LIMIT 1"
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
