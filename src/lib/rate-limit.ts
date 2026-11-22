// Tiny in-memory failure counter for the login endpoint. Single process, no
// persistence: a restart clears it, which is fine for slowing down password
// guessing against a single-user app.

export interface RateLimiterOptions {
  /** Failures allowed per key inside one window before the key is blocked. */
  maxFailures: number
  /** Window length in milliseconds, counted from the first failure. */
  windowMs: number
  /** Injectable clock for tests. */
  now?: () => number
}

export interface RateLimitVerdict {
  allowed: boolean
  /** Seconds until the block lifts; 0 when allowed. */
  retryAfterSeconds: number
}

export interface RateLimiter {
  check(key: string): RateLimitVerdict
  recordFailure(key: string): void
  reset(key: string): void
}

// Cap on tracked keys so a flood of spoofed client addresses can't grow the map
// without bound.
const MAX_TRACKED_KEYS = 5000

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { maxFailures, windowMs } = options
  const now = options.now ?? Date.now
  const entries = new Map<string, { count: number; resetAt: number }>()

  function live(key: string) {
    const entry = entries.get(key)
    if (!entry) return null
    if (entry.resetAt <= now()) {
      entries.delete(key)
      return null
    }
    return entry
  }

  function prune() {
    const t = now()
    for (const [key, entry] of entries) {
      if (entry.resetAt <= t) entries.delete(key)
    }
    // Still over the cap: every remaining entry is live, drop the oldest.
    for (const key of entries.keys()) {
      if (entries.size <= MAX_TRACKED_KEYS) break
      entries.delete(key)
    }
  }

  return {
    check(key) {
      const entry = live(key)
      if (!entry || entry.count < maxFailures) {
        return { allowed: true, retryAfterSeconds: 0 }
      }
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now()) / 1000)),
      }
    },
    recordFailure(key) {
      const entry = live(key)
      if (entry) {
        entry.count++
        return
      }
      if (entries.size >= MAX_TRACKED_KEYS) prune()
      entries.set(key, { count: 1, resetAt: now() + windowMs })
    },
    reset(key) {
      entries.delete(key)
    },
  }
}
