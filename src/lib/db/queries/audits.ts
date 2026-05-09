import type { Database } from "../driver"
import type { Audit, AuditResult, AuditStatus } from "@/types/audit"

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

export function createAudit(db: Database, url: string): Audit {
  db.run("INSERT INTO audits (url) VALUES (?)", [url])
  const row = db
    .query<Audit, []>(
      "SELECT * FROM audits ORDER BY id DESC LIMIT 1"
    )
    .get()
  if (!row) throw new Error("Failed to create audit")
  return row
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
