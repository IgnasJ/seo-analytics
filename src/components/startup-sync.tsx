"use client"

import { useEffect } from "react"

export function StartupSync() {
  useEffect(() => {
    fetch("/api/sync/startup", { method: "POST" }).catch(console.error)
  }, [])
  return null
}
