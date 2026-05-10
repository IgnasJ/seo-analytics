"use client"

import { useEffect, useState } from "react"
import { Monitor, Moon, Sun } from "lucide-react"

const STORAGE_KEY = "theme"
type Theme = "light" | "dark" | "system"

/**
 * Read the system preference once. Returns "light" if matchMedia isn't
 * available (server-side, Edge runtimes).
 */
function systemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

/**
 * Apply the chosen theme to <html>. "system" defers to the OS preference.
 * The bootstrap script in the layout runs the same logic before React
 * mounts to avoid a flash of the wrong theme.
 */
function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return
  const effective = theme === "system" ? systemTheme() : theme
  document.documentElement.classList.toggle("dark", effective === "dark")
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system")

  // Hydrate once on mount.
  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null
    if (stored === "light" || stored === "dark" || stored === "system") {
      setTheme(stored)
    }
  }, [])

  // Re-apply whenever the theme changes; persist the choice.
  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(STORAGE_KEY, theme)
    applyTheme(theme)

    // When following the system, also reapply if the OS preference changes
    // mid-session (e.g. macOS auto dark-mode at sundown).
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)")
      const onChange = () => applyTheme("system")
      mq.addEventListener("change", onChange)
      return () => mq.removeEventListener("change", onChange)
    }
  }, [theme])

  const options: { value: Theme; label: string; Icon: typeof Sun }[] = [
    { value: "light", label: "Light", Icon: Sun },
    { value: "dark", label: "Dark", Icon: Moon },
    { value: "system", label: "System", Icon: Monitor },
  ]

  return (
    <div className="inline-flex rounded-md border bg-background p-0.5 text-xs">
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          aria-pressed={theme === value}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm transition-colors ${
            theme === value
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
        </button>
      ))}
    </div>
  )
}
