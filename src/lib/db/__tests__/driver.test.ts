import { describe, it, expect, beforeEach } from "vitest"
import { Database } from "../driver"

// Regression guard for a subtle RSC crash: `node:sqlite` (which the driver
// wraps) returns rows with a *null prototype*, and React Server Components
// refuse to serialise null-prototype objects across the server→client
// boundary. The driver re-shapes every row into a plain object so a DB row can
// be passed straight to a `"use client"` component as a prop. If this ever
// regresses, `/audit/url` (and any page passing a row to a client island)
// 500s. See src/lib/db/driver.ts.
describe("driver row prototype", () => {
  let db: Database

  beforeEach(() => {
    db = new Database(":memory:")
    db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)")
    db.run("INSERT INTO t (name) VALUES (?)", ["a"])
    db.run("INSERT INTO t (name) VALUES (?)", ["b"])
  })

  it("get() returns a plain object (Object.prototype), not null-prototype", () => {
    const row = db.query<{ id: number; name: string }>("SELECT * FROM t WHERE id = 1").get()
    expect(row).not.toBeNull()
    expect(Object.getPrototypeOf(row)).toBe(Object.prototype)
    expect(row).toEqual({ id: 1, name: "a" })
  })

  it("all() returns plain objects for every row", () => {
    const rows = db.query<{ id: number; name: string }>("SELECT * FROM t ORDER BY id").all()
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(Object.getPrototypeOf(row)).toBe(Object.prototype)
    }
  })

  it("get() still returns null when no row matches", () => {
    const row = db.query("SELECT * FROM t WHERE id = 999").get()
    expect(row).toBeNull()
  })
})
