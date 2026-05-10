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
export function runMigrations(db: Database): void {
  const cols = db
    .query<{ name: string }, []>("PRAGMA table_info(domains)")
    .all()
    .map((c) => c.name)

  if (!cols.includes("category_id")) {
    // SQLite forbids `ALTER TABLE ADD COLUMN ... NOT NULL DEFAULT ... REFERENCES`,
    // so we rebuild the table instead. FK enforcement must be suspended outside
    // the transaction (PRAGMA foreign_keys cannot toggle mid-transaction); we
    // turn it off, do the rename, turn it back on. Cascade-delete relationships
    // from sync_log / *_cache tables are inert during the rebuild because
    // foreign_keys is OFF, so DROP TABLE domains doesn't propagate.
    db.run("PRAGMA foreign_keys = OFF")
    try {
      db.exec(`
        BEGIN TRANSACTION;
        CREATE TABLE domains_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          hostname TEXT NOT NULL UNIQUE,
          ga4_property_id TEXT,
          gsc_site_url TEXT,
          category_id INTEGER NOT NULL DEFAULT 1 REFERENCES categories(id),
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        INSERT INTO domains_new (id, hostname, ga4_property_id, gsc_site_url, created_at)
          SELECT id, hostname, ga4_property_id, gsc_site_url, created_at FROM domains;
        DROP TABLE domains;
        ALTER TABLE domains_new RENAME TO domains;
        COMMIT;
      `)
    } finally {
      db.run("PRAGMA foreign_keys = ON")
    }
  }

  // sync_log.error_message is a plain nullable column, so a normal ALTER
  // works here (no FK / NOT-NULL DEFAULT issues).
  const syncCols = db
    .query<{ name: string }, []>("PRAGMA table_info(sync_log)")
    .all()
    .map((c) => c.name)
  if (!syncCols.includes("error_message")) {
    db.exec("ALTER TABLE sync_log ADD COLUMN error_message TEXT")
  }
}
