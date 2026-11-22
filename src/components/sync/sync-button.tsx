"use client"

import { useState } from "react"
import { RefreshCw, LogIn } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"

export function SyncButton({ domainId, onSynced }: { domainId: number; onSynced?: () => void }) {
  const [loading, setLoading] = useState(false)
  const [needsReauth, setNeedsReauth] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSync() {
    setLoading(true)
    setNeedsReauth(false)
    setError(null)
    try {
      const res = await fetch(`/api/domains/${domainId}/sync`, { method: "POST" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (res.status === 401 && body.error === "reauth_required") {
          setNeedsReauth(true)
          return
        }
        // A sync can fail part-way (one API erroring) while other stages
        // still wrote fresh data, so refresh the page data either way — but
        // tell the user it wasn't a clean run instead of looking successful.
        setError(
          typeof body.error === "string" && body.error
            ? body.error.replace(/^Error:\s*/, "")
            : `Sync failed (${res.status})`
        )
      }
      onSynced?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error")
    } finally {
      setLoading(false)
    }
  }

  if (needsReauth) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-amber-600">Google token expired.</span>
        <a
          href="/api/auth/google"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <LogIn className="w-3 h-3 mr-1.5" />
          Reconnect Google
        </a>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 min-w-0">
      {error && (
        <span
          className="text-xs text-destructive truncate max-w-[16rem]"
          title={error}
          role="status"
        >
          {error}
        </span>
      )}
      <Button variant="outline" size="sm" onClick={handleSync} disabled={loading}>
        <RefreshCw className={`w-3 h-3 mr-1.5 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Syncing…" : "Sync"}
      </Button>
    </div>
  )
}
