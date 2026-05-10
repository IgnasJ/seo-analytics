import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Globe, AlertTriangle, TrendingUp, Link2Off } from "lucide-react"

interface DomainCardProps {
  id: number
  hostname: string
  sessions: number | null
  avgPosition: number | null
  issueCount: number
  lastSyncedAt: number | null
  ga4Linked: boolean
  gscLinked: boolean
}

export function DomainCard({
  id,
  hostname,
  sessions,
  avgPosition,
  issueCount,
  lastSyncedAt,
  ga4Linked,
  gscLinked,
}: DomainCardProps) {
  const syncAgo = lastSyncedAt
    ? Math.round((Date.now() / 1000 - lastSyncedAt) / 3600)
    : null

  const unlinked: string[] = []
  if (!ga4Linked) unlinked.push("GA4")
  if (!gscLinked) unlinked.push("GSC")

  // Layout pattern: full-card Link sits absolute-positioned at z-0 so clicking
  // anywhere navigates to the detail page. Inner content has pointer-events
  // disabled by default so clicks fall through, with specific interactive
  // elements (the unlinked-services warning, here) re-enabling them at z-10
  // to register their own clicks. Avoids the invalid `<a>` inside `<a>`
  // problem and preserves middle-click / right-click behavior on both links.
  return (
    <Card className="relative h-full hover:shadow-md transition-shadow cursor-pointer">
      <Link
        href={`/domain/${id}`}
        aria-label={`Open ${hostname} dashboard`}
        className="absolute inset-0 z-0 rounded-md focus-visible:outline-2 focus-visible:outline-primary"
      />
      <CardHeader className="pb-2 relative z-10 pointer-events-none">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="font-medium text-sm truncate">{hostname}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {issueCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {issueCount}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative z-10 pointer-events-none">
        {unlinked.length > 0 && (
          <Link
            href="/domains"
            className="mb-3 flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 pointer-events-auto hover:bg-amber-100 transition-colors"
          >
            <Link2Off className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              <span className="font-medium">{unlinked.join(" & ")}</span> not
              linked.{" "}
              <span className="underline">Link in Domains →</span>
            </span>
          </Link>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Sessions (1m)</p>
            <p className="text-lg font-semibold">
              {sessions?.toLocaleString() ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Avg Position</p>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-muted-foreground" />
              <p className="text-lg font-semibold">
                {avgPosition ? avgPosition.toFixed(1) : "—"}
              </p>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          {syncAgo !== null ? `Synced ${syncAgo}h ago` : "Never synced"}
        </p>
      </CardContent>
    </Card>
  )
}
