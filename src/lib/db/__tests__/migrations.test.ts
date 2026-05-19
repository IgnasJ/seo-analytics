import { describe, it, expect } from "vitest"
import { Database } from "../driver"
import { runMigrations } from "../index"

// Schema as it existed *before* the categories migration. We build an old-shape
// DB by hand here, populate it, and assert the migration backfills correctly.
const OLD_SCHEMA = `
  CREATE TABLE domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hostname TEXT NOT NULL UNIQUE,
    ga4_property_id TEXT,
    gsc_site_url TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE TABLE sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain_id INTEGER REFERENCES domains(id) ON DELETE CASCADE,
    synced_at INTEGER NOT NULL DEFAULT (unixepoch()),
    status TEXT NOT NULL DEFAULT 'success'
  );
  CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_system INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  INSERT INTO categories (id, name, sort_order, is_system)
    VALUES (1, 'Uncategorized', 999, 1);
`

describe("runMigrations: domains.category_id backfill", () => {
  it("rebuilds the domains table to add category_id with FK to categories(1)", () => {
    const db = new Database(":memory:")
    db.run("PRAGMA foreign_keys=ON")
    db.exec(OLD_SCHEMA)

    // Seed a few rows in the old shape.
    db.run("INSERT INTO domains (hostname) VALUES ('a.com')")
    db.run("INSERT INTO domains (hostname) VALUES ('b.com')")
    db.run("INSERT INTO sync_log (domain_id, status) VALUES (1, 'success')")

    runMigrations(db)

    // Column was added.
    const cols = db
      .query<{ name: string }, []>("PRAGMA table_info(domains)")
      .all()
      .map((c) => c.name)
    expect(cols).toContain("category_id")

    // Existing rows were preserved with category_id defaulting to 1.
    const rows = db
      .query<
        { id: number; hostname: string; category_id: number },
        []
      >("SELECT id, hostname, category_id FROM domains ORDER BY id")
      .all()
    expect(rows).toEqual([
      { id: 1, hostname: "a.com", category_id: 1 },
      { id: 2, hostname: "b.com", category_id: 1 },
    ])

    // FK still resolves: inserting a domain referencing categories(99) should
    // fail since 99 doesn't exist.
    expect(() =>
      db.run(
        "INSERT INTO domains (hostname, category_id) VALUES ('c.com', 99)"
      )
    ).toThrow(/FOREIGN KEY/i)

    // Sync_log rows survived (FK to domains was suspended during rebuild).
    const logs = db
      .query<{ domain_id: number }, []>("SELECT domain_id FROM sync_log")
      .all()
    expect(logs).toEqual([{ domain_id: 1 }])

    // Foreign keys are enforced again after the migration.
    const pragma = db
      .query<{ foreign_keys: number }, []>("PRAGMA foreign_keys")
      .get()!
    expect(pragma.foreign_keys).toBe(1)
  })

  it("is idempotent: running twice on a current-shape DB is a no-op", () => {
    const db = new Database(":memory:")
    db.run("PRAGMA foreign_keys=ON")
    db.exec(OLD_SCHEMA)
    db.run("INSERT INTO domains (hostname) VALUES ('once.com')")

    runMigrations(db)
    runMigrations(db)

    const rows = db
      .query<{ hostname: string; category_id: number }, []>(
        "SELECT hostname, category_id FROM domains"
      )
      .all()
    expect(rows).toEqual([{ hostname: "once.com", category_id: 1 }])
  })
})

describe("runMigrations: settings / guides / guide_steps tables", () => {
  it("creates settings table on fresh DB and is idempotent", () => {
    const db = new Database(":memory:")
    db.run("PRAGMA foreign_keys=ON")
    db.exec(`
      CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE,
        sort_order INTEGER NOT NULL DEFAULT 0, is_system INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()));
      INSERT INTO categories (id, name, sort_order, is_system) VALUES (1,'Uncategorized',999,1);
      CREATE TABLE domains (id INTEGER PRIMARY KEY AUTOINCREMENT,
        hostname TEXT NOT NULL UNIQUE, ga4_property_id TEXT, gsc_site_url TEXT,
        category_id INTEGER NOT NULL DEFAULT 1 REFERENCES categories(id),
        created_at INTEGER NOT NULL DEFAULT (unixepoch()));
      CREATE TABLE sync_log (id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain_id INTEGER REFERENCES domains(id) ON DELETE CASCADE,
        synced_at INTEGER NOT NULL DEFAULT (unixepoch()),
        status TEXT NOT NULL DEFAULT 'success', error_message TEXT);
      CREATE TABLE audits (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending', requested_at INTEGER NOT NULL DEFAULT (unixepoch()),
        completed_at INTEGER, result_json TEXT, error_message TEXT,
        strategy TEXT NOT NULL DEFAULT 'mobile');
    `)
    runMigrations(db)
    runMigrations(db) // idempotent

    const tables = db
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type='table'"
      )
      .all()
      .map((r) => r.name)

    expect(tables).toContain("settings")
    expect(tables).toContain("guides")
    expect(tables).toContain("guide_steps")
  })
})
