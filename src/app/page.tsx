import { getDb } from "@/lib/db"
import { listDomains } from "@/lib/db/queries/domains"
import { getAnalyticsCache, getGscCache, getIssuesCache, getLastSyncedAt } from "@/lib/db/queries/cache"
import { DomainCard } from "@/components/domain-card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import type { AnalyticsReport } from "@/types/analytics"
import type { GscReport, IssuesReport } from "@/types/search-console"

export const dynamic = "force-dynamic"

export default function DashboardPage() {
  const db = getDb()
  const domains = listDomains(db)

  const cards = domains.map((domain) => {
    const analytics = getAnalyticsCache(db, domain.id, "1m") as AnalyticsReport | null
    const gsc = getGscCache(db, domain.id, "1m") as GscReport | null
    const issues = getIssuesCache(db, domain.id) as IssuesReport | null
    const lastSyncedAt = getLastSyncedAt(db, domain.id)

    const issueCount =
      (issues?.sitemaps.reduce((s, sm) => s + sm.errors, 0) ?? 0) +
      (issues?.cwv.lcp?.poor ? 1 : 0) +
      (issues?.cwv.cls?.poor ? 1 : 0) +
      (issues?.cwv.inp?.poor ? 1 : 0)

    return {
      id: domain.id,
      hostname: domain.hostname,
      sessions: analytics?.overview.sessions ?? null,
      avgPosition: gsc?.overview.avgPosition ?? null,
      issueCount,
      lastSyncedAt,
    }
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <Link href="/settings">
          <Button variant="outline" size="sm">+ Add Domain</Button>
        </Link>
      </div>

      {cards.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="mb-3">No domains yet.</p>
          <Link href="/settings">
            <Button size="sm">Add your first domain</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => (
            <DomainCard key={card.id} {...card} />
          ))}
        </div>
      )}
    </div>
  )
}
