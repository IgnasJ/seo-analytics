import type { Database } from "../driver"
import type {
  Audit,
  AuditResult,
  AuditStatus,
  AuditStrategy,
} from "@/types/audit"

export function listAudits(db: Database, limit: number = 50): Audit[] {
  return db
    .query<Audit, [number]>(
      "SELECT * FROM audits ORDER BY requested_at DESC LIMIT ?"
    )
    .all(limit)
}

export function getAudit(db: Database, id: number): Audit | null {
  return db.query<Audit, [number]>("SELECT * FROM audits WHERE id = ?").get(id)
}

export function createAudit(
  db: Database,
  url: string,
  strategy: AuditStrategy = "mobile"
): Audit {
  db.run("INSERT INTO audits (url, strategy) VALUES (?, ?)", [url, strategy])
  const row = db
    .query<Audit, []>(
      "SELECT * FROM audits ORDER BY id DESC LIMIT 1"
    )
    .get()
  if (!row) throw new Error("Failed to create audit")
  return row
}

/**
 * Every audit ever run on a single URL, newest first. Powers `/audit/url`'s
 * trend charts and the audit-pair selector. Returns both mobile and desktop
 * rows — the page splits on strategy in-component.
 */
export function listAuditsForUrl(db: Database, url: string): Audit[] {
  return db
    .query<Audit, [string]>(
      "SELECT * FROM audits WHERE url = ? ORDER BY requested_at DESC"
    )
    .all(url)
}

/**
 * All audits whose URL hostname matches `hostname`, newest first. Uses
 * SQLite's `instr` to match `://hostname/` and `://hostname:` substrings —
 * a cheap, index-free filter that nonetheless rejects URLs like
 * `://example.com.fake/` that would otherwise sneak past a naive LIKE.
 *
 * Always pair with pagination at the call-site; an audit table can grow
 * unbounded so we don't want to materialise everything.
 */
export function listAuditsForHostname(
  db: Database,
  hostname: string,
  limit: number,
  offset: number
): { rows: Audit[]; total: number } {
  // Match three forms: `://host/`, `://host:port/`, and `://host` (trailing-
  // slash-less is rare but valid). We do this with two LIKEs joined by OR.
  const a = `%://${hostname}/%`
  const b = `%://${hostname}:%`
  const c = `https://${hostname}`
  const d = `http://${hostname}`
  const where =
    "url LIKE ? OR url LIKE ? OR url = ? OR url = ?"
  const total =
    db
      .query<{ c: number }, [string, string, string, string]>(
        `SELECT COUNT(*) AS c FROM audits WHERE ${where}`
      )
      .get(a, b, c, d)?.c ?? 0
  const rows = db
    .query<Audit, [string, string, string, string, number, number]>(
      `SELECT * FROM audits WHERE ${where} ORDER BY requested_at DESC LIMIT ? OFFSET ?`
    )
    .all(a, b, c, d, limit, offset)
  return { rows, total }
}

export interface ListAuditsOpts {
  /** Substring match on URL (LIKE %q%). */
  search?: string
  /** Filter by audit status. Undefined = all statuses. */
  status?: AuditStatus
  /** Lower-bound on requested_at (unix seconds). Undefined = no bound. */
  sinceUnix?: number
  limit: number
  offset: number
}

export interface ListAuditsPage {
  rows: Audit[]
  total: number
}

/**
 * Paginated history listing. Returns the page slice plus the total matching
 * count so the renderer can show "Page X of Y". URL-bound filters from
 * `/audit` map directly onto these options.
 */
export function listAuditsFiltered(
  db: Database,
  opts: ListAuditsOpts
): ListAuditsPage {
  // Compose a parameterised WHERE clause from the optional filters. Each
  // condition appends a placeholder + its bound value to keep the call type-
  // safe (SQLite's bind layer rejects shape mismatches).
  const where: string[] = []
  const params: (string | number)[] = []
  if (opts.search && opts.search.trim() !== "") {
    where.push("url LIKE ?")
    params.push(`%${opts.search.trim()}%`)
  }
  if (opts.status) {
    where.push("status = ?")
    params.push(opts.status)
  }
  if (typeof opts.sinceUnix === "number") {
    where.push("requested_at >= ?")
    params.push(opts.sinceUnix)
  }
  const whereSql = where.length === 0 ? "" : `WHERE ${where.join(" AND ")}`

  const total =
    db
      .query<{ c: number }, (string | number)[]>(
        `SELECT COUNT(*) AS c FROM audits ${whereSql}`
      )
      .get(...params)?.c ?? 0

  const rows = db
    .query<Audit, (string | number)[]>(
      `SELECT * FROM audits ${whereSql} ORDER BY requested_at DESC LIMIT ? OFFSET ?`
    )
    .all(...params, opts.limit, opts.offset)

  return { rows, total }
}

export interface UrlGroupRow {
  url: string
  /** Total audits for this URL (any status). */
  count: number
  /** Latest audit row for this URL — its result_json drives the grouped row's
   *  inline score pills. Pulled inline so the renderer doesn't need a second
   *  round-trip per group. */
  latest: Audit
}

/**
 * Distinct URLs in the audit table, paginated, with the latest audit per URL.
 * Powers the `[Grouped by URL]` view on `/audit`. Same filter semantics as
 * `listAuditsFiltered` but the result rows fold by URL.
 *
 * Implementation: build the WHERE once, do `SELECT DISTINCT url ...` for the
 * pager + total, then a second batch fetch for the latest-audit-per-url join.
 */
export function listAuditGroupsFiltered(
  db: Database,
  opts: ListAuditsOpts
): { rows: UrlGroupRow[]; total: number } {
  const where: string[] = []
  const params: (string | number)[] = []
  if (opts.search && opts.search.trim() !== "") {
    where.push("url LIKE ?")
    params.push(`%${opts.search.trim()}%`)
  }
  if (opts.status) {
    where.push("status = ?")
    params.push(opts.status)
  }
  if (typeof opts.sinceUnix === "number") {
    where.push("requested_at >= ?")
    params.push(opts.sinceUnix)
  }
  const whereSql = where.length === 0 ? "" : `WHERE ${where.join(" AND ")}`

  const total =
    db
      .query<{ c: number }, (string | number)[]>(
        `SELECT COUNT(DISTINCT url) AS c FROM audits ${whereSql}`
      )
      .get(...params)?.c ?? 0

  // SQLite-friendly pattern: pick the max requested_at per url within the
  // filter, page the (url, max_ts) result, then re-join to fetch the full
  // latest row for each. Compact, no window functions.
  const urls = db
    .query<{ url: string; max_ts: number; c: number }, (string | number)[]>(
      `SELECT url, MAX(requested_at) AS max_ts, COUNT(*) AS c
         FROM audits
         ${whereSql}
         GROUP BY url
         ORDER BY max_ts DESC
         LIMIT ? OFFSET ?`
    )
    .all(...params, opts.limit, opts.offset)

  if (urls.length === 0) return { rows: [], total }

  // Bulk fetch the latest audit row per URL via a single `IN (...)` round-
  // trip. Bind `url` + `max_ts` pairs as a tuple set isn't portable, so we
  // do one query per URL — N is bounded by the page size (small).
  const rows: UrlGroupRow[] = []
  const stmt = db.query<Audit, [string, number]>(
    "SELECT * FROM audits WHERE url = ? AND requested_at = ? LIMIT 1"
  )
  for (const u of urls) {
    const latest = stmt.get(u.url, u.max_ts)
    if (!latest) continue
    rows.push({ url: u.url, count: u.c, latest })
  }
  return { rows, total }
}

export interface DomainGroupRow {
  hostname: string
  /** Total audits across all URLs on this hostname (any status). */
  audits: number
  /** Distinct URLs audited under this hostname. */
  urls: number
  /** Newest audit on this hostname — drives the latest-scores inline pills. */
  latest: Audit
}

/**
 * Domain-level fold of the audits table: one row per hostname, with audit /
 * URL totals and the newest audit row for inline pills. Same filter semantics
 * as `listAuditsFiltered`.
 *
 * SQLite can't parse URLs, so we extract hostnames in JS after pulling the
 * URL aggregates. Pagination is applied to the resulting domain list — at
 * dashboard scale (hundreds of audits) that's fine.
 */
export function listAuditDomainGroupsFiltered(
  db: Database,
  opts: ListAuditsOpts
): { rows: DomainGroupRow[]; total: number } {
  const where: string[] = []
  const params: (string | number)[] = []
  if (opts.search && opts.search.trim() !== "") {
    where.push("url LIKE ?")
    params.push(`%${opts.search.trim()}%`)
  }
  if (opts.status) {
    where.push("status = ?")
    params.push(opts.status)
  }
  if (typeof opts.sinceUnix === "number") {
    where.push("requested_at >= ?")
    params.push(opts.sinceUnix)
  }
  const whereSql = where.length === 0 ? "" : `WHERE ${where.join(" AND ")}`

  // Pull (url, max_ts, count) for every matching URL — these are the building
  // blocks for the hostname fold. We don't paginate at the SQL layer because
  // pagination needs to land on hostnames, which we don't yet know.
  const urlRows = db
    .query<{ url: string; max_ts: number; c: number }, (string | number)[]>(
      `SELECT url, MAX(requested_at) AS max_ts, COUNT(*) AS c
         FROM audits
         ${whereSql}
         GROUP BY url
         ORDER BY max_ts DESC`
    )
    .all(...params)

  interface Accum {
    hostname: string
    audits: number
    urlSet: Set<string>
    latestUrl: string
    latestTs: number
  }
  const byHost = new Map<string, Accum>()
  for (const u of urlRows) {
    const host = hostnameOf(u.url)
    let acc = byHost.get(host)
    if (!acc) {
      acc = {
        hostname: host,
        audits: 0,
        urlSet: new Set(),
        latestUrl: u.url,
        latestTs: u.max_ts,
      }
      byHost.set(host, acc)
    }
    acc.audits += u.c
    acc.urlSet.add(u.url)
    if (u.max_ts > acc.latestTs) {
      acc.latestTs = u.max_ts
      acc.latestUrl = u.url
    }
  }

  // Newest-first ordering, then page-slice. Total = distinct hostname count.
  const allHosts = [...byHost.values()].sort((a, b) => b.latestTs - a.latestTs)
  const total = allHosts.length
  const page = allHosts.slice(opts.offset, opts.offset + opts.limit)

  if (page.length === 0) return { rows: [], total }

  const stmt = db.query<Audit, [string, number]>(
    "SELECT * FROM audits WHERE url = ? AND requested_at = ? LIMIT 1"
  )
  const rows: DomainGroupRow[] = []
  for (const acc of page) {
    const latest = stmt.get(acc.latestUrl, acc.latestTs)
    if (!latest) continue
    rows.push({
      hostname: acc.hostname,
      audits: acc.audits,
      urls: acc.urlSet.size,
      latest,
    })
  }
  return { rows, total }
}

/**
 * Best-effort hostname extraction from a stored URL. Falls back to the raw
 * string when the URL constructor can't parse it (defensive — should never
 * trigger because audits are normalised before insert).
 */
function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

export function setAuditStatus(
  db: Database,
  id: number,
  status: AuditStatus
): void {
  db.run("UPDATE audits SET status = ? WHERE id = ?", [status, id])
}

export function setAuditResult(
  db: Database,
  id: number,
  result: AuditResult
): void {
  db.run(
    "UPDATE audits SET status = 'done', result_json = ?, completed_at = unixepoch() WHERE id = ?",
    [JSON.stringify(result), id]
  )
}

export function setAuditError(
  db: Database,
  id: number,
  message: string
): void {
  db.run(
    "UPDATE audits SET status = 'error', error_message = ?, completed_at = unixepoch() WHERE id = ?",
    [message, id]
  )
}

/**
 * Find the most recent completed audit for a URL whose id is *less than*
 * `beforeId`. Used to compute diff baselines: "what was this URL's previous
 * audit before the one I'm currently rendering?".
 */
export function getPriorCompletedAudit(
  db: Database,
  url: string,
  beforeId: number
): Audit | null {
  return db
    .query<Audit, [string, number]>(
      "SELECT * FROM audits WHERE url = ? AND id < ? AND status = 'done' ORDER BY id DESC LIMIT 1"
    )
    .get(url, beforeId)
}

export function deleteAudit(db: Database, id: number): void {
  db.run("DELETE FROM audits WHERE id = ?", [id])
}
