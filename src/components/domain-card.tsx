import Link from "next/link"
import { Sparkline } from "@/components/dashboard/sparkline"
import { TrendChip } from "@/components/dashboard/trend-chip"
import { StatusDot } from "@/components/dashboard/status-dot"
import { SyncIcon } from "@/components/dashboard/sync-icon"
import { Hint } from "@/components/ui/hint"
import { cardHealth, type Severity } from "@/lib/seo/health"
import { formatCompact } from "@/lib/format"

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

// Re-exported alias of formatCompact for callers below — keeps the JSX
// readable. Locale-stable across server and client.
const formatNumber = formatCompact

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
            labelTooltip={
              <div className="space-y-1">
                <div>
                  <strong>Sessions</strong> — visits to the site over the last
                  30 days, from Google Analytics 4.
                </div>
                <div>
                  Sparkline shows daily session counts; auto-scaled to this
                  card&apos;s own range.
                </div>
              </div>
            }
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
            labelTooltip={
              <div className="space-y-1">
                <div>
                  <strong>Clicks</strong> — visitors who clicked through from
                  Google Search results in the last 30 days, from Search
                  Console.
                </div>
                <div>
                  Different from sessions: clicks count Google→site arrivals
                  only; sessions count all traffic.
                </div>
              </div>
            }
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
            labelTooltip={
              <div className="space-y-1">
                <div>
                  <strong>Position</strong> — average rank in Google search
                  results across all queries in the last 30 days.
                </div>
                <div>
                  <strong>Lower is better.</strong> Position 1–3 = top of page
                  1, 4–10 = rest of page 1, 11–20 = page 2.
                </div>
              </div>
            }
            value={position1m !== null ? position1m.toFixed(1) : "—"}
            spark={
              <Hint
                text={
                  <div className="space-y-1">
                    <div>
                      Compares your <strong>last 7 days</strong> against your{" "}
                      <strong>30-day baseline</strong>. Both are simple
                      averages of the per-query positions in their period.
                    </div>
                    <div>
                      Green ↓ means your recent week is ranking better than
                      your normal (recent number is lower than the baseline).
                      Red ↑ means it slipped.
                    </div>
                  </div>
                }
                className="inline-flex pointer-events-auto"
              >
                <span className="cursor-help">
                  {/* current = recent 7-day average, previous = 30-day
                      baseline — so a smaller "current" is an improvement. */}
                  <TrendChip
                    current={position7d}
                    previous={position1m}
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
  labelTooltip,
  value,
  spark,
}: {
  label: string
  labelTooltip?: React.ReactNode
  value: string
  spark: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="min-w-0">
        <span className="font-semibold font-mono tabular-nums">{value}</span>
        {labelTooltip ? (
          <Hint text={labelTooltip} className="inline-flex ml-1.5 pointer-events-auto">
            <span className="text-xs text-muted-foreground cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2">
              {label}
            </span>
          </Hint>
        ) : (
          <span className="ml-1.5 text-xs text-muted-foreground">{label}</span>
        )}
      </span>
      <span className="shrink-0">{spark}</span>
    </div>
  )
}
