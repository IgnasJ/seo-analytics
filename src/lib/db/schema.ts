export const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_system INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  INSERT OR IGNORE INTO categories (id, name, sort_order, is_system)
    VALUES (1, 'Uncategorized', 999, 1);

  CREATE TABLE IF NOT EXISTS domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hostname TEXT NOT NULL UNIQUE,
    ga4_property_id TEXT,
    gsc_site_url TEXT,
    category_id INTEGER NOT NULL DEFAULT 1 REFERENCES categories(id),
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS oauth_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_account_email TEXT NOT NULL,
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT NOT NULL,
    expires_at INTEGER,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain_id INTEGER REFERENCES domains(id) ON DELETE CASCADE,
    synced_at INTEGER NOT NULL DEFAULT (unixepoch()),
    status TEXT NOT NULL DEFAULT 'success'
  );

  CREATE TABLE IF NOT EXISTS analytics_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain_id INTEGER NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    date_range TEXT NOT NULL,
    data_json TEXT NOT NULL,
    synced_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(domain_id, date_range)
  );

  CREATE TABLE IF NOT EXISTS gsc_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain_id INTEGER NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    date_range TEXT NOT NULL,
    data_json TEXT NOT NULL,
    synced_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(domain_id, date_range)
  );

  CREATE TABLE IF NOT EXISTS issues_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain_id INTEGER NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    data_json TEXT NOT NULL,
    synced_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(domain_id)
  );
`
