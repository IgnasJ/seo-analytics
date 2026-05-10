"use client"

import { useEffect, useState } from "react"
import { LayoutGrid, BarChart3 } from "lucide-react"

const STORAGE_KEY = "dashboard-view-mode"
type Mode = "cards" | "cards+kpi"

interface Props {
  /** Initial mode rendered on the server (defaults to "cards"). */
  defaultMode?: Mode
}

/**
 * Segmented [Cards | Cards + KPI] toggle. Persists to localStorage so the
 * mode survives reloads. Toggling the mode adds/removes a `data-kpi="on"`
 * attribute on `document.body`, which the KPI strip element reads via a
 * sibling-selector CSS rule to show or hide itself — keeps the toggle
 * client-only without forcing the page to re-render.
 */
export function ViewToggle({ defaultMode = "cards" }: Props) {
  const [mode, setMode] = useState<Mode>(defaultMode)

  // Hydrate from localStorage on first mount.
  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === "cards" || stored === "cards+kpi") {
      setMode(stored)
    }
  }, [])

  // Reflect mode on body so CSS can show/hide the KPI strip.
  useEffect(() => {
    if (typeof document === "undefined") return
    document.body.dataset.kpi = mode === "cards+kpi" ? "on" : "off"
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, mode)
    }
  }, [mode])

  return (
    <div className="inline-flex rounded-md border bg-background p-0.5 text-xs">
      <button
        type="button"
        onClick={() => setMode("cards")}
        aria-pressed={mode === "cards"}
        className={`flex items-center gap-1 px-2 py-1 rounded-sm transition-colors ${
          mode === "cards"
            ? "bg-accent text-accent-foreground font-medium"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <LayoutGrid className="w-3 h-3" />
        Cards
      </button>
      <button
        type="button"
        onClick={() => setMode("cards+kpi")}
        aria-pressed={mode === "cards+kpi"}
        className={`flex items-center gap-1 px-2 py-1 rounded-sm transition-colors ${
          mode === "cards+kpi"
            ? "bg-accent text-accent-foreground font-medium"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <BarChart3 className="w-3 h-3" />
        + KPI
      </button>
    </div>
  )
}
