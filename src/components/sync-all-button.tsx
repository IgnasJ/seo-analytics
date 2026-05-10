"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw } from "lucide-react"

interface SyncResult {
  total: number
  succeeded: number
  failed: { hostname: string; error: string }[]
}

export function SyncAllButton() {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function syncAll() {
    if (running) return
    setRunning(true)
    setResult(null)
    setError(null)
    try {
      const res = await fetch("/api/sync/all", { method: "POST" })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.error ?? `Request failed (${res.status})`)
        return
      }
      setResult(body as SyncResult)
      // Refresh server-rendered pages so the new sync timestamps surface.
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error")
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button size="sm" onClick={syncAll} disabled={running}>
        {running ? (
          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
        ) : (
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
        )}
        {running ? "Syncing all domains…" : "Sync all domains now"}
      </Button>
      {result && (
        <div className="text-xs text-muted-foreground">
          Synced{" "}
          <span className="font-medium text-foreground">
            {result.succeeded} of {result.total}
          </span>{" "}
          domain(s).
          {result.failed.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-destructive">
              {result.failed.map((f) => (
                <li key={f.hostname}>
                  <span className="font-medium">{f.hostname}</span>: {f.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
