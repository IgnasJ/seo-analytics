import { describe, it, expect, beforeEach } from "bun:test"
import { Database } from "bun:sqlite"
import { SCHEMA_SQL } from "../schema"

describe("database schema", () => {
  let db: Database

  beforeEach(() => {
    db = new Database(":memory:")
    db.run("PRAGMA foreign_keys=ON")
    db.exec(SCHEMA_SQL)
  })

  it("creates all required tables", () => {
    const tables = db
      .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
    const names = tables.map((t) => t.name)
    expect(names).toContain("domains")
    expect(names).toContain("oauth_tokens")
    expect(names).toContain("sync_log")
    expect(names).toContain("analytics_cache")
    expect(names).toContain("gsc_cache")
    expect(names).toContain("issues_cache")
  })

  it("enforces unique hostname in domains", () => {
    db.run("INSERT INTO domains (hostname) VALUES ('example.com')")
    expect(() =>
      db.run("INSERT INTO domains (hostname) VALUES ('example.com')")
    ).toThrow()
  })

  it("cascades domain delete to sync_log", () => {
    db.run("INSERT INTO domains (hostname) VALUES ('test.com')")
    const { id } = db.query<{ id: number }, []>("SELECT id FROM domains").get()!
    db.run("INSERT INTO sync_log (domain_id) VALUES (?)", [id])
    db.run("DELETE FROM domains WHERE id = ?", [id])
    const logs = db.query<{ id: number }, [number]>("SELECT * FROM sync_log WHERE domain_id = ?").all(id)
    expect(logs).toHaveLength(0)
  })
})
