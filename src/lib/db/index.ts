import { Database } from "./driver"
import { SCHEMA_SQL } from "./schema"

let db: Database | null = null

export function getDb(): Database {
  if (!db) {
    const path = process.env.DB_PATH ?? "./data/analytics.db"
    db = new Database(path, { create: true })
    db.run("PRAGMA journal_mode=WAL")
    db.run("PRAGMA foreign_keys=ON")
    db.exec(SCHEMA_SQL)
    runMigrations(db)
  }
  return db
}

/**
 * Idempotent post-schema migrations for older DBs that predate columns added
 * after initial release. Safe to run on every boot — each step checks first.
 */
function runMigrations(db: Database): void {
  const cols = db
    .query<{ name: string }, []>("PRAGMA table_info(domains)")
    .all()
    .map((c) => c.name)
  if (!cols.includes("category_id")) {
    db.exec(
      "ALTER TABLE domains ADD COLUMN category_id INTEGER NOT NULL DEFAULT 1 REFERENCES categories(id)"
    )
  }
}
