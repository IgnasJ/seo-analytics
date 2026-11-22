import { describe, it, expect } from "vitest"
import { createRateLimiter } from "../rate-limit"

function setup(maxFailures = 3, windowMs = 60_000) {
  let t = 1_000_000
  const limiter = createRateLimiter({ maxFailures, windowMs, now: () => t })
  return { limiter, advance: (ms: number) => { t += ms } }
}

describe("createRateLimiter", () => {
  it("allows until the failure budget is used up", () => {
    const { limiter } = setup(3)
    expect(limiter.check("a").allowed).toBe(true)
    limiter.recordFailure("a")
    limiter.recordFailure("a")
    expect(limiter.check("a").allowed).toBe(true)
    limiter.recordFailure("a")
    const verdict = limiter.check("a")
    expect(verdict.allowed).toBe(false)
    expect(verdict.retryAfterSeconds).toBe(60)
  })

  it("tracks keys independently", () => {
    const { limiter } = setup(1)
    limiter.recordFailure("a")
    expect(limiter.check("a").allowed).toBe(false)
    expect(limiter.check("b").allowed).toBe(true)
  })

  it("lifts the block when the window expires", () => {
    const { limiter, advance } = setup(1, 60_000)
    limiter.recordFailure("a")
    advance(30_000)
    expect(limiter.check("a")).toEqual({ allowed: false, retryAfterSeconds: 30 })
    advance(30_000)
    expect(limiter.check("a").allowed).toBe(true)
  })

  it("reset clears a key immediately", () => {
    const { limiter } = setup(1)
    limiter.recordFailure("a")
    limiter.reset("a")
    expect(limiter.check("a").allowed).toBe(true)
  })
})
