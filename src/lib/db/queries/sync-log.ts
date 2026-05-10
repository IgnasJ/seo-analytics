import type { Database } from "../driver"

export interface SyncLogEntry {
  id: number
  domain_id: number | null
  hostname: string | null
  status: "success" | "error"
  synced_at: number
  error_message: string | null
}

export interface SyncLogPage {
  entries: SyncLogEntry[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const MAX_PAGE_SIZE = 100
const DEFAULT_PAGE_SIZE = 20

export function listSyncLog(
  db: Database,
  options: { page?: number; pageSize?: number } = {}
): SyncLogPage {
  const pageSize = Math.min(
    Math.max(1, options.pageSize ?? DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE
  )
  const page = Math.max(1, options.page ?? 1)
  const offset = (page - 1) * pageSize

  const total =
    db
      .query<{ n: number }, []>("SELECT COUNT(*) as n FROM sync_log")
      .get()?.n ?? 0

  // Left-join domains so deleted-domain rows still surface (sync_log has
  // ON DELETE CASCADE so this is mostly defensive — but if cascade ever
  // changes, we want orphaned entries to be visible rather than swallowed.)
  const entries = db
    .query<SyncLogEntry, [number, number]>(
      `SELECT s.id, s.domain_id, s.status, s.synced_at, s.error_message, d.hostname
       FROM sync_log s
       LEFT JOIN domains d ON d.id = s.domain_id
       ORDER BY s.synced_at DESC, s.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(pageSize, offset)

  return {
    entries,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}
