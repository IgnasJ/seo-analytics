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

export function buildAuthUrl(): string {
  const client = createOAuthClient()
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
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

export async function getValidAccessToken(refreshTokenEncrypted: string): Promise<string> {
  const { decrypt } = await import("../crypto")
  const client = createOAuthClient()
  client.setCredentials({ refresh_token: decrypt(refreshTokenEncrypted) })
  try {
    const { token } = await client.getAccessToken()
    if (!token) throw new Error("Failed to refresh access token")
    return token
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes("invalid_grant") || (err as { code?: number }).code === 400) {
      throw new InvalidGrantError()
    }
    throw err
  }
}
