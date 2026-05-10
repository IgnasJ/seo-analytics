"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

export function StartupSync() {
  const pathname = usePathname()
  useEffect(() => {
    if (pathname === "/login") return
    fetch("/api/sync/startup", { method: "POST" }).catch(console.error)
  }, [pathname])
  return null
}
