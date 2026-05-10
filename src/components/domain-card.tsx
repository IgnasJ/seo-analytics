import Link from "next/link"
import { Sparkline } from "@/components/dashboard/sparkline"
import { TrendChip } from "@/components/dashboard/trend-chip"
import { StatusDot } from "@/components/dashboard/status-dot"
import { SyncIcon } from "@/components/dashboard/sync-icon"
import { Hint } from "@/components/ui/hint"
import { cardHealth, type Severity } from "@/lib/seo/health"

export interface DomainCardProps {
  id: number
  hostname: string
  /** Cached series — last ~30 days. */
  dailySessions: number[]
  dailyClicks: number[]
  /** Snapshot metric values. */
  sessions: number | null
  clicks: number | null
  /** Avg position over the current (1m) range and the 7d range, for the trend chip. */
  position1m: number | null
  position7d: number | null
  /** Health signals fed into cardHealth. */
  ga4Linked: boolean
  gscLinked: boolean
  lastSyncedAt: number | null
  lastSyncStatus: "success" | "error" | null
  issueCount: number
}

const BORDER_COLOR: Record<Severity, string> = {
  green: "border-l-green-500",
  amber: "border-l-amber-500",
  red: "border-l-red-500",
}

function formatNumber(n: number | null): string {
  if (n === null) return "—"
  if (n >= 10000) return `${(n / 1000).toFixed(1)}K`
  return n.toLocaleString()
}

export function DomainCard(props: DomainCardProps) {
  const {
    id,
    hostname,
    dailySessions,
    dailyClicks,
    sessions,
    clicks,
    position1m,
    position7d,
    ga4Linked,
    gscLinked,
    lastSyncedAt,
    lastSyncStatus,
    issueCount,
  } = props

  const { severity, reasons } = cardHealth({
    ga4Linked,
    gscLinked,
    lastSyncedAt,
    lastSyncStatus,
    issueCount,
  })

  // Layered links: full-card link covers the card via z-0 + pointer-events
  // fallthrough; the StatusDot tooltip and SyncIcon sit at z-10 with their
  // own click targets re-enabled.
  return (
    <div
      className={`relative h-full rounded-md border bg-card border-l-4 ${BORDER_COLOR[severity]} hover:shadow-md transition-shadow cursor-pointer group`}
    >
      <Link
        href={`/domain/${id}`}
        aria-label={`Open ${hostname} dashboard`}
        className="absolute inset-0 z-0 rounded-md focus-visible:outline-2 focus-visible:outline-primary"
      />

      <div className="relative z-10 p-3 pointer-events-none">
        {/* Header row: status dot + hostname (left), sync clock (right) */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0 pointer-events-auto">
            <StatusDot severity={severity} reasons={reasons} />
            <span className="font-medium text-sm truncate">{hostname}</span>
          </div>
          <SyncIcon
            domainId={id}
            lastSyncedAt={lastSyncedAt}
            lastSyncStatus={lastSyncStatus}
          />
        </div>

        {/* Three metric rows: number left, sparkline / trend chip right */}
        <div className="space-y-1">
          <MetricRow
            label="sessions"
            value={formatNumber(sessions)}
            spark={
              <Sparkline
                values={dailySessions}
                className="text-blue-500"
                ariaLabel="Sessions trend"
              />
            }
          />
          <MetricRow
            label="clicks"
            value={formatNumber(clicks)}
            spark={
              <Sparkline
                values={dailyClicks}
                className="text-emerald-500"
                ariaLabel="Clicks trend"
              />
            }
          />
          <MetricRow
            label="position"
            value={position1m !== null ? position1m.toFixed(1) : "—"}
            spark={
              <Hint
                text={
                  <div className="space-y-1">
                    <div>
                      <strong>Position</strong> is the average rank of this site
                      across Google search results in the selected period.
                    </div>
                    <div>
                      <strong>Lower is better</strong> — position 3 means rank
                      #3 (top of page 1); position 18 is bottom of page 2.
                    </div>
                    <div>
                      The chip compares the last 30 days vs the last 7 days.
                      Green ↓ means rank improved (number went down); red ↑
                      means rank slipped.
                    </div>
                  </div>
                }
                className="inline-flex"
              >
                <span className="cursor-help">
                  <TrendChip
                    current={position1m}
                    previous={position7d}
                    lowerIsBetter
                    format="absolute"
                    decimals={1}
                  />
                </span>
              </Hint>
            }
          />
        </div>
      </div>
    </div>
  )
}

function MetricRow({
  label,
  value,
  spark,
}: {
  label: string
  value: string
  spark: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="min-w-0">
        <span className="font-semibold font-mono tabular-nums">{value}</span>
        <span className="ml-1.5 text-xs text-muted-foreground">{label}</span>
      </span>
      <span className="shrink-0">{spark}</span>
    </div>
  )
}
