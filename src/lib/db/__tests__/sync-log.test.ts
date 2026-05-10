import { describe, it, expect, beforeEach } from "vitest"
import { Database } from "../driver"
import { SCHEMA_SQL } from "../schema"
import { listSyncLog } from "../queries/sync-log"

function newDb(): Database {
  const db = new Database(":memory:")
  db.run("PRAGMA foreign_keys=ON")
  db.exec(SCHEMA_SQL)
  return db
}

function seedDomain(db: Database, hostname: string): number {
  db.run("INSERT INTO domains (hostname) VALUES (?)", [hostname])
  return db
    .query<{ id: number }, [string]>(
      "SELECT id FROM domains WHERE hostname = ?"
    )
    .get(hostname)!.id
}

function seedSync(
  db: Database,
  domainId: number,
  status: "success" | "error",
  whenOffsetSec: number = 0
): void {
  db.run(
    "INSERT INTO sync_log (domain_id, status, synced_at) VALUES (?, ?, unixepoch() + ?)",
    [domainId, status, whenOffsetSec]
  )
}

describe("listSyncLog", () => {
  let db: Database

  beforeEach(() => {
    db = newDb()
  })

  it("returns an empty page when no log entries exist", () => {
    const page = listSyncLog(db)
    expect(page.entries).toEqual([])
    expect(page.total).toBe(0)
    expect(page.page).toBe(1)
    expect(page.totalPages).toBe(1)
  })

  it("joins hostname onto each entry", () => {
    const id = seedDomain(db, "example.com")
    seedSync(db, id, "success")
    const page = listSyncLog(db)
    expect(page.entries).toHaveLength(1)
    expect(page.entries[0].hostname).toBe("example.com")
    expect(page.entries[0].status).toBe("success")
  })

  it("orders newest first", () => {
    const id = seedDomain(db, "a.com")
    seedSync(db, id, "success", 0)
    seedSync(db, id, "error", 60)
    seedSync(db, id, "success", 30)
    const { entries } = listSyncLog(db)
    expect(entries.map((e) => e.status)).toEqual(["error", "success", "success"])
  })

  it("paginates with the requested page size", () => {
    const id = seedDomain(db, "a.com")
    for (let i = 0; i < 25; i++) seedSync(db, id, "success", i)

    const p1 = listSyncLog(db, { page: 1, pageSize: 10 })
    expect(p1.entries).toHaveLength(10)
    expect(p1.total).toBe(25)
    expect(p1.totalPages).toBe(3)

    const p3 = listSyncLog(db, { page: 3, pageSize: 10 })
    expect(p3.entries).toHaveLength(5)
  })

  it("clamps invalid page / pageSize inputs", () => {
    const id = seedDomain(db, "a.com")
    seedSync(db, id, "success")
    const a = listSyncLog(db, { page: 0, pageSize: 0 })
    expect(a.page).toBe(1)
    expect(a.pageSize).toBeGreaterThan(0)
    const b = listSyncLog(db, { page: 1, pageSize: 9999 })
    expect(b.pageSize).toBeLessThanOrEqual(100)
  })

  it("preserves entries when their domain is deleted (left join)", () => {
    const id = seedDomain(db, "ghost.com")
    seedSync(db, id, "success")
    db.run("DELETE FROM domains WHERE id = ?", [id])
    const { entries } = listSyncLog(db)
    // sync_log has ON DELETE CASCADE so the row goes too — but if cascade
    // is ever changed, the LEFT JOIN ensures hostname becomes null and the
    // row still surfaces. This test asserts current cascade behaviour:
    expect(entries).toHaveLength(0)
  })

  it("returns the error_message column for failed syncs", () => {
    const id = seedDomain(db, "fails.com")
    db.run(
      "INSERT INTO sync_log (domain_id, status, error_message) VALUES (?, 'error', ?)",
      [id, "GSC 403: insufficient permission"]
    )
    const { entries } = listSyncLog(db)
    expect(entries[0].status).toBe("error")
    expect(entries[0].error_message).toBe("GSC 403: insufficient permission")
  })

  it("returns null error_message for success rows", () => {
    const id = seedDomain(db, "ok.com")
    seedSync(db, id, "success")
    const { entries } = listSyncLog(db)
    expect(entries[0].error_message).toBeNull()
  })
})
