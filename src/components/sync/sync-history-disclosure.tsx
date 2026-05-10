"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { SyncHistory } from "./sync-history"

/**
 * Collapsible wrapper around SyncHistory. Defers mounting the table until
 * first expanded so we don't fire the /api/sync-log fetch on every settings
 * page load.
 */
export function SyncHistoryDisclosure() {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-t pt-3 mt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {open ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        {open ? "Hide sync history" : "View sync history"}
      </button>
      {open && (
        <div className="mt-3">
          <SyncHistory />
        </div>
      )}
    </div>
  )
}
