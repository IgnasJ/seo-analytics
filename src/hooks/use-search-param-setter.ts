"use client"

import { useCallback } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

/**
 * Returns a function that patches the current URL's query string and replaces
 * the route in place (no scroll jump, no history entry per click). `null`
 * removes a key. Used by filter controls on server-rendered pages, where the
 * URL is the single source of truth for the active filters.
 */
export function useSearchParamSetter(): (patch: Record<string, string | null>) => void {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  return useCallback(
    (patch) => {
      const next = new URLSearchParams(params)
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) next.delete(key)
        else next.set(key, value)
      }
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname, params]
  )
}
