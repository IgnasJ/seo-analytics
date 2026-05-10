// Next.js 16 calls this file `proxy.ts` (formerly `middleware.ts`). It runs
// before every request that matches the config below, and gates non-public
// pages and API routes on a valid signed session cookie.
//
// Auth is opt-in: if APP_PASSWORD isn't set we short-circuit to `next()` so
// development setups and existing single-user deployments continue to work.

import { NextResponse, type NextRequest } from "next/server"
import {
  AUTH_COOKIE_NAME,
  getAuthConfig,
  verifySession,
} from "@/lib/auth"

// Paths exempt from the auth gate. Everything else (including the OAuth
// callback at /api/auth/callback) requires a valid session — by the time the
// browser follows a Google OAuth redirect, it carries our session cookie too.
const PUBLIC_PATHS = new Set<string>([
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
])

export async function proxy(request: NextRequest) {
  const cfg = getAuthConfig()
  if (!cfg.enabled) return NextResponse.next()

  const path = request.nextUrl.pathname
  if (PUBLIC_PATHS.has(path)) return NextResponse.next()

  const cookie = request.cookies.get(AUTH_COOKIE_NAME)?.value
  const session = await verifySession(cookie)
  if (session) return NextResponse.next()

  // For API routes, return JSON 401 so client fetch() callers can detect it.
  if (path.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // For pages, redirect to the login form, preserving the requested path so
  // we can bounce back after success.
  const loginUrl = new URL("/login", request.url)
  if (path !== "/") loginUrl.searchParams.set("next", path + request.nextUrl.search)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // Run on every path except Next.js internals and static asset routes. The
  // matcher itself can't read env, so the proxy's first line short-circuits
  // when auth is disabled.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|css|js|map)$).*)"],
}
