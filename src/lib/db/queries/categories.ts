import type { Database } from "../driver"

export interface Category {
  id: number
  name: string
  sort_order: number
  is_system: number
  created_at: number
}

export const UNCATEGORIZED_ID = 1

export function listCategories(db: Database): Category[] {
  return db
    .query<Category, []>(
      "SELECT * FROM categories ORDER BY sort_order ASC, name ASC"
    )
    .all()
}

export function getCategory(db: Database, id: number): Category | null {
  return db.query<Category, [number]>("SELECT * FROM categories WHERE id = ?").get(id)
}

export function createCategory(db: Database, name: string): Category {
  const trimmed = name.trim()
  if (!trimmed) throw new Error("Category name required")

  // Place new categories just above Uncategorized (sort_order 999) by using
  // max(sort_order excluding system rows) + 1.
  const max = db
    .query<{ max: number | null }, []>(
      "SELECT MAX(sort_order) as max FROM categories WHERE is_system = 0"
    )
    .get()
  const nextOrder = (max?.max ?? -1) + 1

  db.run("INSERT INTO categories (name, sort_order) VALUES (?, ?)", [
    trimmed,
    nextOrder,
  ])
  return db
    .query<Category, [string]>("SELECT * FROM categories WHERE name = ?")
    .get(trimmed)!
}

export function renameCategory(db: Database, id: number, name: string): void {
  const trimmed = name.trim()
  if (!trimmed) throw new Error("Category name required")
  const existing = getCategory(db, id)
  if (!existing) throw new Error(`Category ${id} not found`)
  if (existing.is_system) throw new Error("System category cannot be renamed")
  db.run("UPDATE categories SET name = ? WHERE id = ?", [trimmed, id])
}

export function reorderCategories(
  db: Database,
  ordered: { id: number; sort_order: number }[]
): void {
  for (const { id, sort_order } of ordered) {
    db.run("UPDATE categories SET sort_order = ? WHERE id = ? AND is_system = 0", [
      sort_order,
      id,
    ])
  }
}

/**
 * Delete a category. Reassigns its domains to Uncategorized first.
 * Throws if attempting to delete the system Uncategorized row.
 */
export function deleteCategory(db: Database, id: number): void {
  const existing = getCategory(db, id)
  if (!existing) throw new Error(`Category ${id} not found`)
  if (existing.is_system) throw new Error("Uncategorized cannot be deleted")
  db.run("UPDATE domains SET category_id = ? WHERE category_id = ?", [
    UNCATEGORIZED_ID,
    id,
  ])
  db.run("DELETE FROM categories WHERE id = ?", [id])
}
