"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart2, Settings, Globe, Layers, Search } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "Dashboard", icon: BarChart2 },
  { href: "/domains", label: "Domains", icon: Layers },
  { href: "/audit", label: "Audit", icon: Search },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-56 min-h-screen border-r bg-background flex flex-col">
      <div className="px-4 py-5 border-b">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Globe className="w-4 h-4" />
          SEO Dashboard
        </div>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                pathname === item.href
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
