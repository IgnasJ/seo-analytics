"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

// Module-scoped guard. This component lives in the root layout, so it stays
// mounted across client-side navigations — without this flag the effect would
// re-POST on every route change (it depends on `pathname`). A "startup" sync
// should run once per app load. The module re-initialises (resetting the flag)
// only on a full page reload — including the post-login hard navigation
// (`window.location.href` in login/page.tsx), so the sync still runs once after
// sign-in.
let hasSynced = false

export function StartupSync() {
  const pathname = usePathname()
  useEffect(() => {
    if (hasSynced || pathname === "/login") return
    hasSynced = true
    fetch("/api/sync/startup", { method: "POST" }).catch(console.error)
  }, [pathname])
  return null
}
