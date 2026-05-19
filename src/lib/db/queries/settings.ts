import type { Database } from "../driver"

export function getSetting(db: Database, key: string): string | null {
  return (
    db
      .query<{ value: string }, [string]>(
        "SELECT value FROM settings WHERE key = ?"
      )
      .get(key)?.value ?? null
  )
}

export function setSetting(db: Database, key: string, value: string): void {
  db.run(
    `INSERT INTO settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()`,
    [key, value]
  )
}
