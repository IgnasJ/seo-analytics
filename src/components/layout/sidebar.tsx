"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  BarChart2,
  Settings,
  Globe,
  Layers,
  Search,
  Menu,
  X,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "Dashboard", icon: BarChart2 },
  { href: "/domains", label: "Domains", icon: Layers },
  { href: "/audit", label: "Audit", icon: Search },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Login page renders standalone — no sidebar chrome.
  if (pathname === "/login") return null

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Lock body scroll while the drawer is open on mobile.
  useEffect(() => {
    if (typeof document === "undefined") return
    if (mobileOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [mobileOpen])

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    window.location.href = "/login"
  }

  const navList = (
    <nav className="flex-1 px-2 py-3 flex flex-col">
      <div className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          )
        })}
      </div>
      <button
        type="button"
        onClick={logout}
        className="mt-auto flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Sign out
      </button>
    </nav>
  )

  return (
    <>
      {/* Mobile bottom bar — pinned at the bottom for thumb-friendly menu
          access. Sits above the safe-area inset so it stays clear of the
          home-bar gesture area on iOS. */}
      <header
        className="md:hidden fixed inset-x-0 bottom-0 z-30 flex items-center justify-between bg-background border-t px-3 py-2"
        style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
      >
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-sm"
        >
          <Globe className="w-4 h-4" />
          SEO Dashboard
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          className="p-2 rounded-md hover:bg-accent"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Desktop persistent sidebar */}
      <aside className="hidden md:flex w-56 min-h-screen border-r bg-background flex-col shrink-0">
        <div className="px-4 py-5 border-b">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold text-sm hover:opacity-80 transition-opacity"
          >
            <Globe className="w-4 h-4" />
            SEO Dashboard
          </Link>
        </div>
        {navList}
      </aside>

      {/* Mobile drawer + backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          "md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-background border-r shadow-lg flex flex-col transition-transform duration-200 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        role="dialog"
        aria-label="Navigation"
        aria-hidden={!mobileOpen}
      >
        <div className="px-4 py-4 border-b flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold text-sm">
            <Globe className="w-4 h-4" />
            SEO Dashboard
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation menu"
            className="p-1.5 rounded-md hover:bg-accent"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {navList}
      </aside>
    </>
  )
}
