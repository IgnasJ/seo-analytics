import { Database } from "bun:sqlite"
import { SCHEMA_SQL } from "./schema"

let db: Database | null = null

export function getDb(): Database {
  if (!db) {
    const path = process.env.DB_PATH ?? "./data/analytics.db"
    db = new Database(path, { create: true })
    db.run("PRAGMA journal_mode=WAL")
    db.run("PRAGMA foreign_keys=ON")
    db.exec(SCHEMA_SQL)
  }
  return db
}
