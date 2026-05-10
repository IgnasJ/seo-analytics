import { NextRequest, NextResponse } from "next/server"
import {
  AUTH_COOKIE_MAX_AGE,
  AUTH_COOKIE_NAME,
  checkCredentials,
  getAuthConfig,
  signSession,
} from "@/lib/auth"

export async function POST(req: NextRequest) {
  const cfg = getAuthConfig()
  if (!cfg.enabled) {
    return NextResponse.json(
      { error: "Auth is disabled (no APP_PASSWORD set)." },
      { status: 503 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const username = typeof body.username === "string" ? body.username : ""
  const password = typeof body.password === "string" ? body.password : ""

  if (!checkCredentials(username, password)) {
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 }
    )
  }

  const cookieValue = await signSession(cfg.username)
  const isHttps =
    (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://")

  const res = NextResponse.json({ ok: true })
  res.cookies.set(AUTH_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE,
  })
  return res
}
