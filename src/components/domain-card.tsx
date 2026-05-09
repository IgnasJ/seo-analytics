import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Globe, AlertTriangle, TrendingUp } from "lucide-react"

interface DomainCardProps {
  id: number
  hostname: string
  sessions: number | null
  avgPosition: number | null
  issueCount: number
  lastSyncedAt: number | null
}

export function DomainCard({ id, hostname, sessions, avgPosition, issueCount, lastSyncedAt }: DomainCardProps) {
  const syncAgo = lastSyncedAt
    ? Math.round((Date.now() / 1000 - lastSyncedAt) / 3600)
    : null

  return (
    <Link href={`/domain/${id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm truncate max-w-[160px]">{hostname}</span>
            </div>
            {issueCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {issueCount}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Sessions (1m)</p>
              <p className="text-lg font-semibold">{sessions?.toLocaleString() ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg Position</p>
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-muted-foreground" />
                <p className="text-lg font-semibold">{avgPosition ? avgPosition.toFixed(1) : "—"}</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {syncAgo !== null ? `Synced ${syncAgo}h ago` : "Never synced"}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}
