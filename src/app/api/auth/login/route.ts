import { NextRequest, NextResponse } from "next/server"
import {
  AUTH_COOKIE_MAX_AGE,
  AUTH_COOKIE_NAME,
  checkCredentials,
  getAuthConfig,
  signSession,
} from "@/lib/auth"
import { createRateLimiter } from "@/lib/rate-limit"

// Password-guessing brake. Two budgets, both counting *failed* attempts only:
//  - per client address, so one noisy client is cut off quickly;
//  - global, because the address comes from a forwarding header that a direct
//    client can spoof to dodge the per-address budget.
const WINDOW_MS = 5 * 60 * 1000
const perClient = createRateLimiter({ maxFailures: 10, windowMs: WINDOW_MS })
const allClients = createRateLimiter({ maxFailures: 100, windowMs: WINDOW_MS })
const GLOBAL_KEY = "*"

function clientKey(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return forwarded || req.headers.get("x-real-ip")?.trim() || "unknown"
}

export async function POST(req: NextRequest) {
  const cfg = getAuthConfig()
  if (!cfg.enabled) {
    return NextResponse.json(
      { error: "Auth is disabled (no APP_PASSWORD set)." },
      { status: 503 }
    )
  }

  const client = clientKey(req)
  const blocked = [perClient.check(client), allClients.check(GLOBAL_KEY)].find(
    (v) => !v.allowed
  )
  if (blocked) {
    return NextResponse.json(
      { error: "Too many failed attempts. Try again in a few minutes." },
      {
        status: 429,
        headers: { "Retry-After": String(blocked.retryAfterSeconds) },
      }
    )
  }

  const body = await req.json().catch(() => ({}))
  const username = typeof body.username === "string" ? body.username : ""
  const password = typeof body.password === "string" ? body.password : ""

  if (!checkCredentials(username, password)) {
    perClient.recordFailure(client)
    allClients.recordFailure(GLOBAL_KEY)
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 }
    )
  }

  perClient.reset(client)

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
