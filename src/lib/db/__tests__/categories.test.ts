import { describe, it, expect, beforeEach } from "vitest"
import { Database } from "../driver"
import { SCHEMA_SQL } from "../schema"
import {
  listCategories,
  createCategory,
  renameCategory,
  reorderCategories,
  deleteCategory,
  UNCATEGORIZED_ID,
} from "../queries/categories"

function newDb(): Database {
  const db = new Database(":memory:")
  db.run("PRAGMA foreign_keys=ON")
  db.exec(SCHEMA_SQL)
  return db
}

describe("categories queries", () => {
  let db: Database

  beforeEach(() => {
    db = newDb()
  })

  it("seeds Uncategorized as id=1", () => {
    const cats = listCategories(db)
    expect(cats).toHaveLength(1)
    expect(cats[0].id).toBe(UNCATEGORIZED_ID)
    expect(cats[0].name).toBe("Uncategorized")
    expect(cats[0].is_system).toBe(1)
  })

  it("creates a category with auto-incrementing sort_order", () => {
    const a = createCategory(db, "Client")
    const b = createCategory(db, "Personal")
    expect(a.sort_order).toBeLessThan(b.sort_order)
    expect(a.is_system).toBe(0)
    const all = listCategories(db)
    expect(all.map((c) => c.name)).toEqual(["Client", "Personal", "Uncategorized"])
  })

  it("rejects duplicate category names via UNIQUE constraint", () => {
    createCategory(db, "Client")
    expect(() => createCategory(db, "Client")).toThrow()
  })

  it("renames a non-system category", () => {
    const c = createCategory(db, "Client")
    renameCategory(db, c.id, "Client (active)")
    const fresh = listCategories(db).find((x) => x.id === c.id)!
    expect(fresh.name).toBe("Client (active)")
  })

  it("refuses to rename the system category", () => {
    expect(() => renameCategory(db, UNCATEGORIZED_ID, "Other")).toThrow(/system/i)
  })

  it("reorders only non-system categories", () => {
    const a = createCategory(db, "A")
    const b = createCategory(db, "B")
    reorderCategories(db, [
      { id: a.id, sort_order: 5 },
      { id: b.id, sort_order: 2 },
      { id: UNCATEGORIZED_ID, sort_order: 0 }, // attempt should be ignored
    ])
    const ordered = listCategories(db)
    // sort_order ASC: B (2), A (5), Uncategorized (still 999, untouched)
    expect(ordered.map((c) => c.name)).toEqual(["B", "A", "Uncategorized"])
  })

  it("delete reassigns domains to Uncategorized then removes the row", () => {
    const c = createCategory(db, "Client")
    db.run("INSERT INTO domains (hostname, category_id) VALUES ('a.com', ?)", [c.id])
    db.run("INSERT INTO domains (hostname, category_id) VALUES ('b.com', ?)", [c.id])

    deleteCategory(db, c.id)

    const remaining = listCategories(db)
    expect(remaining.find((x) => x.id === c.id)).toBeUndefined()

    const reassigned = db
      .query<{ hostname: string; category_id: number }, []>(
        "SELECT hostname, category_id FROM domains"
      )
      .all()
    expect(reassigned).toHaveLength(2)
    expect(reassigned.every((r) => r.category_id === UNCATEGORIZED_ID)).toBe(true)
  })

  it("refuses to delete the system Uncategorized category", () => {
    expect(() => deleteCategory(db, UNCATEGORIZED_ID)).toThrow(/cannot be deleted/i)
  })
})
