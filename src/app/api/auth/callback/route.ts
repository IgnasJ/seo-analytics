import { NextRequest, NextResponse } from "next/server"
import { exchangeCode, OAUTH_STATE_COOKIE } from "@/lib/google/oauth"
import { encrypt } from "@/lib/crypto"
import { constantTimeEqual } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { upsertToken } from "@/lib/db/queries/tokens"

function settingsRedirect(result: "success" | "error"): NextResponse {
  const res = NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL}/settings?auth=${result}`
  )
  // One-shot nonce: clear it whatever the outcome.
  res.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/api/auth", maxAge: 0 })
  return res
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 })

  // Reject callbacks that don't belong to a flow this browser started.
  const state = request.nextUrl.searchParams.get("state") ?? ""
  const expected = request.cookies.get(OAUTH_STATE_COOKIE)?.value ?? ""
  if (!state || !expected || !constantTimeEqual(state, expected)) {
    console.error("OAuth callback rejected: state mismatch")
    return settingsRedirect("error")
  }

  try {
    const tokens = await exchangeCode(code)
    const db = getDb()
    upsertToken(
      db,
      tokens.email,
      encrypt(tokens.refreshToken),
      encrypt(tokens.accessToken),
      tokens.expiresAt
    )
    return settingsRedirect("success")
  } catch (err) {
    console.error("OAuth callback error:", err)
    return settingsRedirect("error")
  }
}
