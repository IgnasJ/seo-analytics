"use client"

import { useState } from "react"
import { RefreshCw, LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"

export function SyncButton({ domainId, onSynced }: { domainId: number; onSynced?: () => void }) {
  const [loading, setLoading] = useState(false)
  const [needsReauth, setNeedsReauth] = useState(false)

  async function handleSync() {
    setLoading(true)
    setNeedsReauth(false)
    try {
      const res = await fetch(`/api/domains/${domainId}/sync`, { method: "POST" })
      if (res.status === 401) {
        const body = await res.json().catch(() => ({}))
        if (body.error === "reauth_required") {
          setNeedsReauth(true)
          return
        }
      }
      onSynced?.()
    } finally {
      setLoading(false)
    }
  }

  if (needsReauth) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-amber-600">Google token expired.</span>
        <Button variant="outline" size="sm" asChild>
          <a href="/api/auth/google">
            <LogIn className="w-3 h-3 mr-1.5" />
            Reconnect Google
          </a>
        </Button>
      </div>
    )
  }

  return (
    <Button variant="outline" size="sm" onClick={handleSync} disabled={loading}>
      <RefreshCw className={`w-3 h-3 mr-1.5 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Syncing…" : "Sync"}
    </Button>
  )
}
