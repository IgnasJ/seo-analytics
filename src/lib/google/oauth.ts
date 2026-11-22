import { google } from "googleapis"

const SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
]

export function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`
  )
}

/** Cookie that carries the OAuth `state` nonce between redirect and callback. */
export const OAUTH_STATE_COOKIE = "oauth_state"

/**
 * `state` is a per-flow random nonce the callback must see again (it is also
 * stored in a cookie). Without it anyone could feed our callback an
 * authorisation code for *their* Google account and silently swap the linked
 * account.
 */
export function buildAuthUrl(state: string): string {
  const client = createOAuthClient()
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  })
}

export interface TokenSet {
  accessToken: string
  refreshToken: string
  expiresAt: number
  email: string
}

export async function exchangeCode(code: string): Promise<TokenSet> {
  const client = createOAuthClient()
  const { tokens } = await client.getToken(code)
  if (!tokens.refresh_token) throw new Error("No refresh token returned — ensure prompt=consent")

  client.setCredentials(tokens)
  const oauth2 = google.oauth2({ version: "v2", auth: client })
  const { data } = await oauth2.userinfo.get()

  return {
    accessToken: tokens.access_token!,
    refreshToken: tokens.refresh_token,
    expiresAt: tokens.expiry_date ?? Date.now() + 3600_000,
    email: data.email!,
  }
}

export class InvalidGrantError extends Error {
  constructor() {
    super("Google token expired or revoked — re-authentication required")
    this.name = "InvalidGrantError"
  }
}

// Access tokens live for about an hour. "Sync all" asks for one per domain, so
// without this every domain paid a token-refresh round-trip to Google. Keyed by
// the stored (encrypted) refresh token: reconnecting the account changes the
// key and naturally invalidates the entry.
const ACCESS_TOKEN_SAFETY_MARGIN_MS = 5 * 60 * 1000
const ASSUMED_TOKEN_LIFETIME_MS = 55 * 60 * 1000
let cachedAccessToken: { key: string; token: string; expiresAt: number } | null = null

export async function getValidAccessToken(refreshTokenEncrypted: string): Promise<string> {
  if (
    cachedAccessToken &&
    cachedAccessToken.key === refreshTokenEncrypted &&
    cachedAccessToken.expiresAt - ACCESS_TOKEN_SAFETY_MARGIN_MS > Date.now()
  ) {
    return cachedAccessToken.token
  }

  const { decrypt } = await import("../crypto")
  const client = createOAuthClient()
  client.setCredentials({ refresh_token: decrypt(refreshTokenEncrypted) })
  try {
    const { token } = await client.getAccessToken()
    if (!token) throw new Error("Failed to refresh access token")
    cachedAccessToken = {
      key: refreshTokenEncrypted,
      token,
      expiresAt:
        client.credentials.expiry_date ?? Date.now() + ASSUMED_TOKEN_LIFETIME_MS,
    }
    return token
  } catch (err) {
    cachedAccessToken = null
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes("invalid_grant") || (err as { code?: number }).code === 400) {
      throw new InvalidGrantError()
    }
    throw err
  }
}
