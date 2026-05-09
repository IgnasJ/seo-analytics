import { getDb } from "@/lib/db"
import { listDomains } from "@/lib/db/queries/domains"
import { listCategories } from "@/lib/db/queries/categories"
import {
  getAnalyticsCache,
  getGscCache,
  getIssuesCache,
  getLastSyncedAt,
} from "@/lib/db/queries/cache"
import { DomainCard } from "@/components/domain-card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import type { AnalyticsReport } from "@/types/analytics"
import type { GscReport, IssuesReport } from "@/types/search-console"

export const dynamic = "force-dynamic"

interface CardData {
  id: number
  hostname: string
  category_id: number
  sessions: number | null
  avgPosition: number | null
  issueCount: number
  lastSyncedAt: number | null
}

export default function DashboardPage() {
  const db = getDb()
  const domains = listDomains(db)
  const categories = listCategories(db)

  const cards: CardData[] = domains.map((domain) => {
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
      category_id: domain.category_id,
      sessions: analytics?.overview.sessions ?? null,
      avgPosition: gsc?.overview.avgPosition ?? null,
      issueCount,
      lastSyncedAt,
    }
  })

  // Group cards by category, preserving the categories' sort order. Empty
  // categories are filtered out.
  const grouped = categories
    .map((category) => ({
      category,
      cards: cards.filter((c) => c.category_id === category.id),
    }))
    .filter((g) => g.cards.length > 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <Link href="/domains">
          <Button variant="outline" size="sm">
            + Add Domain
          </Button>
        </Link>
      </div>

      {cards.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="mb-3">No domains yet.</p>
          <Link href="/domains">
            <Button size="sm">Add your first domain</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ category, cards }) => (
            <section key={category.id}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                {category.name}{" "}
                <span className="text-xs font-normal normal-case">
                  ({cards.length})
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cards.map((card) => (
                  <DomainCard key={card.id} {...card} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
