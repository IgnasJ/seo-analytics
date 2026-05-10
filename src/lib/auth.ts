// Single-user app auth: HMAC-signed session cookie, credentials sourced from
// environment variables. No DB tables, no external service. Uses Web Crypto
// rather than node:crypto so the proxy (which may run in the Edge runtime)
// can use the same primitives without a runtime check.

export const AUTH_COOKIE_NAME = "app_session"
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export interface AuthConfig {
  username: string
  password: string
  /** True iff a non-empty APP_PASSWORD is set; otherwise auth is bypassed. */
  enabled: boolean
}

export function getAuthConfig(): AuthConfig {
  const password = process.env.APP_PASSWORD ?? ""
  const username = process.env.APP_USERNAME?.trim() || "admin"
  return { username, password, enabled: password.length > 0 }
}

/**
 * Cookie-signing secret. Reuses ENCRYPTION_KEY (already required for OAuth
 * token storage) so deployments don't have to manage a third secret. If
 * ENCRYPTION_KEY is unset for some reason we fall back to APP_PASSWORD; both
 * being missing means auth is disabled and signSession is never called.
 */
function getSigningSecret(): string {
  const key = process.env.ENCRYPTION_KEY ?? process.env.APP_PASSWORD ?? ""
  if (!key) {
    throw new Error(
      "Auth: ENCRYPTION_KEY (or APP_PASSWORD) must be set to sign sessions"
    )
  }
  return key
}

async function hmacSign(data: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(getSigningSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data))
  return base64UrlEncode(new Uint8Array(sig))
}

function base64UrlEncode(input: Uint8Array | string): string {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : input
  let bin = ""
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function base64UrlDecodeToString(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (input.length % 4)) % 4)
  const bin = atob(padded)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

/**
 * Constant-time string equality. Returns false fast on length mismatch (length
 * itself is not secret here — both inputs come from a fixed env var or a fixed
 * username, which an attacker can already infer from the deployment).
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

export function checkCredentials(username: string, password: string): boolean {
  const cfg = getAuthConfig()
  if (!cfg.enabled) return false
  // Always run both compares so timing doesn't leak which one mismatched.
  const u = constantTimeEqual(username, cfg.username)
  const p = constantTimeEqual(password, cfg.password)
  return u && p
}

export interface SessionPayload {
  username: string
  /** Unix seconds. */
  exp: number
}

/**
 * Build a signed session cookie value. Format: `<base64url(payload)>.<sig>`
 * where payload = `username:exp`.
 */
export async function signSession(
  username: string,
  ttlSeconds: number = AUTH_COOKIE_MAX_AGE
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds
  const payload = `${username}:${exp}`
  const sig = await hmacSign(payload)
  return `${base64UrlEncode(payload)}.${sig}`
}

export async function verifySession(
  cookie: string | undefined
): Promise<SessionPayload | null> {
  if (!cookie) return null
  const dot = cookie.lastIndexOf(".")
  if (dot < 1 || dot >= cookie.length - 1) return null
  const payload64 = cookie.slice(0, dot)
  const sig = cookie.slice(dot + 1)

  let payload: string
  try {
    payload = base64UrlDecodeToString(payload64)
  } catch {
    return null
  }

  const expectedSig = await hmacSign(payload)
  if (!constantTimeEqual(sig, expectedSig)) return null

  const colon = payload.lastIndexOf(":")
  if (colon < 1) return null
  const username = payload.slice(0, colon)
  const exp = Number(payload.slice(colon + 1))
  if (!username || !Number.isFinite(exp)) return null
  if (exp < Math.floor(Date.now() / 1000)) return null
  return { username, exp }
}
