import { randomBytes } from "node:crypto"
import { NextResponse } from "next/server"
import { buildAuthUrl, OAUTH_STATE_COOKIE } from "@/lib/google/oauth"

export function GET() {
  // Bind this browser to the flow it started: the callback only accepts a code
  // that comes back with the same nonce we stored here.
  const state = randomBytes(24).toString("base64url")
  const res = NextResponse.redirect(buildAuthUrl(state))
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    // Lax, not strict: the cookie must ride along on Google's top-level
    // redirect back to our callback.
    sameSite: "lax",
    secure: (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://"),
    path: "/api/auth",
    maxAge: 10 * 60,
  })
  return res
}
