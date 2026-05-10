"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Clock, Loader2 } from "lucide-react"
import { Hint } from "@/components/ui/hint"
import { formatDateTime } from "@/lib/format"

interface Props {
  domainId: number
  lastSyncedAt: number | null
  lastSyncStatus: "success" | "error" | null
}

function relative(unixSeconds: number): string {
  const ageMin = Math.round(Date.now() / 1000 / 60 - unixSeconds / 60)
  if (ageMin < 60) return `${ageMin} min ago`
  if (ageMin < 60 * 24) return `${Math.round(ageMin / 60)} h ago`
  return `${Math.round(ageMin / 60 / 24)} d ago`
}

export function SyncIcon({ domainId, lastSyncedAt, lastSyncStatus }: Props) {
  const router = useRouter()
  const [running, setRunning] = useState(false)

  async function syncNow(e: React.MouseEvent) {
    // Prevent the surrounding card-link from intercepting the click.
    e.preventDefault()
    e.stopPropagation()
    if (running) return
    setRunning(true)
    try {
      await fetch(`/api/domains/${domainId}/sync`, { method: "POST" })
      router.refresh()
    } finally {
      setRunning(false)
    }
  }

  let tooltip: string
  if (running) {
    tooltip = "Syncing now…"
  } else if (lastSyncedAt === null) {
    tooltip = "Never synced — click to sync now"
  } else {
    const abs = formatDateTime(lastSyncedAt)
    const rel = relative(lastSyncedAt)
    tooltip =
      lastSyncStatus === "error"
        ? `Last attempt failed ${rel} — ${abs}. Click to retry.`
        : `Synced ${rel} — ${abs}. Click to sync now.`
  }

  return (
    <Hint text={tooltip} className="inline-flex pointer-events-auto">
      <button
        type="button"
        onClick={syncNow}
        disabled={running}
        aria-label="Sync now"
        className="p-1.5 -m-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
      >
        {running ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Clock className="w-3.5 h-3.5" />
        )}
      </button>
    </Hint>
  )
}
