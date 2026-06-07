"use client"

import { useEffect, useRef } from "react"

/**
 * Polls `fn` on an interval while `active` is true *and* the tab is visible.
 * Built for "watch jobs until they finish" loops (e.g. audit status).
 *
 * Guarantees:
 * - stops when `active` becomes false (all jobs done), on unmount, and while
 *   the browser tab is hidden — resuming with an immediate catch-up fetch when
 *   the tab becomes visible again;
 * - never overlaps: if `fn` is still running when the next tick fires, that
 *   tick is skipped rather than firing a second concurrent request.
 *
 * `fn` is read through a ref, so passing a fresh closure each render does not
 * restart the interval — only `active` / `intervalMs` changes do.
 */
export function usePoll(
  fn: () => Promise<void> | void,
  active: boolean,
  intervalMs: number
): void {
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    if (!active || typeof document === "undefined") return

    let timer: ReturnType<typeof setInterval> | null = null
    let inFlight = false

    const tick = async () => {
      // Skip if a previous fetch is still running or the tab is backgrounded.
      if (inFlight || document.hidden) return
      inFlight = true
      try {
        await fnRef.current()
      } finally {
        inFlight = false
      }
    }

    const start = () => {
      if (!timer) timer = setInterval(tick, intervalMs)
    }
    const stop = () => {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    }

    const onVisibility = () => {
      if (document.hidden) {
        stop()
      } else {
        void tick() // catch up immediately on return
        start()
      }
    }

    if (!document.hidden) start()
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      stop()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [active, intervalMs])
}
