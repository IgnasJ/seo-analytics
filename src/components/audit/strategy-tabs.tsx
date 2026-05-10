"use client"

import { useState, type ReactNode } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import type { AuditStrategy } from "@/types/audit"

interface Props {
  initialStrategy: AuditStrategy
  mobileCount: number
  desktopCount: number
  /** Already-rendered server content for each strategy tab. */
  mobileContent: ReactNode
  desktopContent: ReactNode
}

/**
 * Client-owned controlled Tabs wrapper for `/audit/url`. The parent is a
 * server component; if it re-renders (e.g. after a `router.refresh()` post
 * re-audit) the strategy choice would otherwise flip back to whatever the
 * newest audit recorded, which trips base-ui's "default value changed"
 * warning. Owning the tab in client state keeps the user's selection
 * sticky across refreshes.
 */
export function StrategyTabs({
  initialStrategy,
  mobileCount,
  desktopCount,
  mobileContent,
  desktopContent,
}: Props) {
  // Pin the initial value once; subsequent server-component refreshes don't
  // touch this. Falls back to whichever side has data when the recommended
  // initial would otherwise point to an empty tab.
  const [value, setValue] = useState<AuditStrategy>(() => {
    if (initialStrategy === "desktop" && desktopCount > 0) return "desktop"
    if (mobileCount > 0) return "mobile"
    return "desktop"
  })

  return (
    <Tabs
      value={value}
      onValueChange={(v) =>
        setValue(v === "desktop" ? "desktop" : "mobile")
      }
    >
      <TabsList>
        <TabsTrigger value="mobile" disabled={mobileCount === 0}>
          Mobile
          <Badge variant="outline" className="ml-2 text-[10px]">
            {mobileCount}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="desktop" disabled={desktopCount === 0}>
          Desktop
          <Badge variant="outline" className="ml-2 text-[10px]">
            {desktopCount}
          </Badge>
        </TabsTrigger>
      </TabsList>

      {mobileCount > 0 && (
        <TabsContent value="mobile">{mobileContent}</TabsContent>
      )}
      {desktopCount > 0 && (
        <TabsContent value="desktop">{desktopContent}</TabsContent>
      )}
    </Tabs>
  )
}
