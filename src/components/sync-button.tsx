"use client"

import { useState } from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export function SyncButton({ domainId, onSynced }: { domainId: number; onSynced?: () => void }) {
  const [loading, setLoading] = useState(false)

  async function handleSync() {
    setLoading(true)
    try {
      await fetch(`/api/domains/${domainId}/sync`, { method: "POST" })
      onSynced?.()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleSync} disabled={loading}>
      <RefreshCw className={`w-3 h-3 mr-1.5 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Syncing…" : "Sync"}
    </Button>
  )
}
