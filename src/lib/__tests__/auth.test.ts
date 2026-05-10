import { describe, it, expect, beforeEach } from "vitest"
import {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_MAX_AGE,
  checkCredentials,
  constantTimeEqual,
  getAuthConfig,
  signSession,
  verifySession,
} from "../auth"

const ENV_KEYS = ["APP_USERNAME", "APP_PASSWORD", "ENCRYPTION_KEY"]

beforeEach(() => {
  for (const k of ENV_KEYS) delete process.env[k]
})

describe("getAuthConfig", () => {
  it("is disabled when APP_PASSWORD is unset", () => {
    expect(getAuthConfig().enabled).toBe(false)
  })

  it("is disabled when APP_PASSWORD is empty", () => {
    process.env.APP_PASSWORD = ""
    expect(getAuthConfig().enabled).toBe(false)
  })

  it("defaults username to 'admin'", () => {
    process.env.APP_PASSWORD = "secret"
    expect(getAuthConfig().username).toBe("admin")
  })

  it("respects APP_USERNAME override", () => {
    process.env.APP_PASSWORD = "secret"
    process.env.APP_USERNAME = "ignas"
    expect(getAuthConfig().username).toBe("ignas")
  })

  it("trims whitespace-only username back to default", () => {
    process.env.APP_PASSWORD = "secret"
    process.env.APP_USERNAME = "   "
    expect(getAuthConfig().username).toBe("admin")
  })
})

describe("checkCredentials", () => {
  it("returns false when auth disabled", () => {
    expect(checkCredentials("admin", "")).toBe(false)
  })

  it("accepts the configured pair", () => {
    process.env.APP_PASSWORD = "swordfish"
    process.env.APP_USERNAME = "ignas"
    expect(checkCredentials("ignas", "swordfish")).toBe(true)
  })

  it("rejects wrong password", () => {
    process.env.APP_PASSWORD = "swordfish"
    expect(checkCredentials("admin", "swordfis")).toBe(false)
  })

  it("rejects wrong username", () => {
    process.env.APP_PASSWORD = "swordfish"
    expect(checkCredentials("Admin", "swordfish")).toBe(false)
  })
})

describe("session sign/verify round-trip", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = "a".repeat(64)
  })

  it("signs and verifies a fresh session", async () => {
    const cookie = await signSession("ignas")
    const session = await verifySession(cookie)
    expect(session?.username).toBe("ignas")
    expect(session?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })

  it("rejects undefined or empty cookie", async () => {
    expect(await verifySession(undefined)).toBeNull()
    expect(await verifySession("")).toBeNull()
  })

  it("rejects malformed cookie", async () => {
    expect(await verifySession("notacookie")).toBeNull()
    expect(await verifySession("only.dotbutgarbage")).toBeNull()
  })

  it("rejects tampered signature", async () => {
    const cookie = await signSession("ignas")
    const tampered = cookie.slice(0, -1) + (cookie.endsWith("a") ? "b" : "a")
    expect(await verifySession(tampered)).toBeNull()
  })

  it("rejects tampered username (forged payload)", async () => {
    const cookie = await signSession("ignas")
    const [, sig] = cookie.split(".")
    // Build a payload claiming to be 'admin' with the same signature.
    const fakePayload = Buffer.from(`admin:${Math.floor(Date.now() / 1000) + 60}`)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")
    const fake = `${fakePayload}.${sig}`
    expect(await verifySession(fake)).toBeNull()
  })

  it("rejects expired session", async () => {
    const cookie = await signSession("ignas", -10) // already expired
    expect(await verifySession(cookie)).toBeNull()
  })

  it("uses APP_PASSWORD as fallback signing secret when ENCRYPTION_KEY is absent", async () => {
    delete process.env.ENCRYPTION_KEY
    process.env.APP_PASSWORD = "fallback-secret"
    const cookie = await signSession("ignas")
    const session = await verifySession(cookie)
    expect(session?.username).toBe("ignas")
  })
})

describe("constantTimeEqual", () => {
  it("matches identical strings", () => {
    expect(constantTimeEqual("abcd", "abcd")).toBe(true)
  })

  it("rejects mismatches", () => {
    expect(constantTimeEqual("abcd", "abce")).toBe(false)
  })

  it("rejects different lengths", () => {
    expect(constantTimeEqual("abc", "abcd")).toBe(false)
  })
})

describe("constants", () => {
  it("uses a sensible cookie name and 30-day max age", () => {
    expect(AUTH_COOKIE_NAME).toBe("app_session")
    expect(AUTH_COOKIE_MAX_AGE).toBe(60 * 60 * 24 * 30)
  })
})
