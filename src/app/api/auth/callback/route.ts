import { NextRequest, NextResponse } from "next/server"
import { exchangeCode } from "@/lib/google/oauth"
import { encrypt } from "@/lib/crypto"
import { getDb } from "@/lib/db"
import { upsertToken } from "@/lib/db/queries/tokens"

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 })

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
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?auth=success`)
  } catch (err) {
    console.error("OAuth callback error:", err)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?auth=error`)
  }
}
