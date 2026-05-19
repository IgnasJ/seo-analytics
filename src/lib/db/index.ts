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

  // audits.strategy — added so we can record mobile vs desktop per audit.
  // Plain ALTER works: NOT NULL with a constant DEFAULT is allowed by SQLite
  // (unlike NOT NULL DEFAULT with REFERENCES which forced the rebuild above).
  // Guard on table existence first because some migration tests build a
  // pre-`audits` legacy schema.
  const hasAudits =
    db
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='audits'"
      )
      .get() !== null
  if (hasAudits) {
    const auditCols = db
      .query<{ name: string }, []>("PRAGMA table_info(audits)")
      .all()
      .map((c) => c.name)
    if (!auditCols.includes("strategy")) {
      db.exec("ALTER TABLE audits ADD COLUMN strategy TEXT NOT NULL DEFAULT 'mobile'")
    }
  }

  // settings, guides, guide_steps — added for AI improvement guide feature.
  // CREATE TABLE IF NOT EXISTS is safe to re-run; no ALTER needed.
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS guides (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      domain_id     INTEGER NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
      url           TEXT NOT NULL,
      query         TEXT NOT NULL,
      model         TEXT NOT NULL,
      raw_markdown  TEXT NOT NULL,
      generated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      superseded_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_guides_lookup
      ON guides(domain_id, url, query, superseded_at);

    CREATE TABLE IF NOT EXISTS guide_steps (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      guide_id  INTEGER NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
      position  INTEGER NOT NULL,
      section   TEXT NOT NULL CHECK(section IN ('optimize', 'new_page')),
      text      TEXT NOT NULL,
      forecast  TEXT,
      done      INTEGER NOT NULL DEFAULT 0,
      done_at   INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_guide_steps_guide
      ON guide_steps(guide_id, position);
  `)
}
