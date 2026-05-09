import type { Database } from "bun:sqlite"

export interface OAuthToken {
  id: number
  google_account_email: string
  access_token_encrypted: string | null
  refresh_token_encrypted: string
  expires_at: number | null
  updated_at: number
}

export function getToken(db: Database): OAuthToken | null {
  return db.query<OAuthToken, []>("SELECT * FROM oauth_tokens LIMIT 1").get()
}

export function upsertToken(
  db: Database,
  email: string,
  refreshTokenEncrypted: string,
  accessTokenEncrypted: string | null,
  expiresAt: number | null
): void {
  const existing = getToken(db)
  if (existing) {
    db.run(
      `UPDATE oauth_tokens SET
        google_account_email = ?,
        refresh_token_encrypted = ?,
        access_token_encrypted = ?,
        expires_at = ?,
        updated_at = unixepoch()
       WHERE id = ?`,
      [email, refreshTokenEncrypted, accessTokenEncrypted, expiresAt, existing.id]
    )
  } else {
    db.run(
      `INSERT INTO oauth_tokens (google_account_email, refresh_token_encrypted, access_token_encrypted, expires_at)
       VALUES (?, ?, ?, ?)`,
      [email, refreshTokenEncrypted, accessTokenEncrypted, expiresAt]
    )
  }
}
