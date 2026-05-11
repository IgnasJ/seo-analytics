"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ChevronDown,
  ChevronRight,
  TrendingDown,
  AlertTriangle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Hint } from "@/components/ui/hint"
import { formatInteger, formatDateTime } from "@/lib/format"
import type { AuditSummary } from "@/lib/audit/aggregates"

interface Props {
  /** Window in days. Used to label the card; the API caps the scan window. */
  days?: number
  /** Initial summary if the parent server-rendered one. When omitted we
   *  fetch on mount; this matches the current /audit page being a client
   *  component. */
  initial?: AuditSummary
  /** Notify parent when the user clicks a common-failure row — the parent
   *  uses this to apply that failure's id as a filter on the history list. */
  onApplyCommonFailureFilter?: (auditId: string) => void
}

/**
 * Collapsible cross-URL summary card for /audit. Defaults closed because the
 * page's primary action is "run another audit" — the summary is a deeper look
 * the user opts into.
 */
export function AuditSummaryCard({
  days = 30,
  initial,
  onApplyCommonFailureFilter,
}: Props) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<AuditSummary | null>(initial ?? null)
  const [loading, setLoading] = useState(false)

  // Lazy-fetch on first open. Cheap once cached; the summary endpoint walks
  // at most HARD_LIMIT rows and rolls them up in-process.
  useEffect(() => {
    if (!open || data) return
    let abandoned = false
    setLoading(true)
    fetch(`/api/audit/summary?days=${days}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (!abandoned && body) setData(body as AuditSummary)
      })
      .finally(() => {
        if (!abandoned) setLoading(false)
      })
    return () => {
      abandoned = true
    }
  }, [open, data, days])

  // The collapsed header still surfaces the headline numbers when we have
  // them — that's where the value lives even before expansion.
  const headline =
    data?.kpis && data.kpis.total > 0
      ? `${data.kpis.total} audits · Perf ${data.kpis.avgPerformance ?? "—"} avg · SEO ${data.kpis.avgSeo ?? "—"} avg · ${data.kpis.failingAudits} failing`
      : null

  return (
    <Card>
      <CardHeader className="pb-3">
        <button
          type="button"
          className="flex items-center gap-2 text-left w-full"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? (
            <ChevronDown className="w-4 h-4 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 shrink-0" />
          )}
          <CardTitle className="text-sm">
            Audit summary · last {days}d
          </CardTitle>
          {headline && (
            <span className="text-xs text-muted-foreground ml-2 truncate">
              {headline}
            </span>
          )}
        </button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4">
          {loading && !data && (
            <p className="text-sm text-muted-foreground">Loading summary…</p>
          )}
          {data && data.kpis.total === 0 && (
            <p className="text-sm text-muted-foreground">
              No completed audits in this window yet.
            </p>
          )}
          {data && data.kpis.total > 0 && (
            <>
              <KpiStrip kpis={data.kpis} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <WorstPagesList rows={data.worstPages} />
                <CommonFailuresList
                  rows={data.commonFailures}
                  onApply={onApplyCommonFailureFilter}
                />
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  )
}

function KpiStrip({ kpis }: { kpis: AuditSummary["kpis"] }) {
  const tiles: { label: string; value: string; tone?: string }[] = [
    { label: "Audits", value: formatInteger(kpis.total) },
    {
      label: "Avg Performance",
      value: kpis.avgPerformance == null ? "—" : String(kpis.avgPerformance),
      tone: scoreTone(kpis.avgPerformance),
    },
    {
      label: "Avg SEO",
      value: kpis.avgSeo == null ? "—" : String(kpis.avgSeo),
      tone: scoreTone(kpis.avgSeo),
    },
    {
      label: "Failing",
      value: `${kpis.failingAudits} / ${kpis.total}`,
      tone: kpis.failingAudits > 0 ? "text-red-600" : "text-muted-foreground",
    },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="border rounded-md px-3 py-2 flex flex-col"
        >
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {t.label}
          </span>
          <span
            className={`text-lg font-semibold tabular-nums ${t.tone ?? ""}`}
          >
            {t.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function scoreTone(score: number | null): string {
  if (score == null) return ""
  if (score >= 90) return "text-green-600"
  if (score >= 50) return "text-amber-600"
  return "text-red-600"
}

function WorstPagesList({ rows }: { rows: AuditSummary["worstPages"] }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-medium mb-2">
        <TrendingDown className="w-3.5 h-3.5 text-red-600" />
        <span>Worst pages by overall score</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing failing yet.</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {rows.map((r) => (
            <li
              key={r.url}
              className="flex items-center justify-between gap-2 border rounded-md px-2 py-1.5"
            >
              <Link
                href={`/audit/url?u=${encodeURIComponent(r.url)}`}
                className="truncate text-xs underline-offset-2 hover:underline"
                title={r.url}
              >
                {r.url}
              </Link>
              <div className="flex items-center gap-1 shrink-0 text-xs tabular-nums">
                <Hint
                  text={`Performance: ${r.performance} / 100`}
                  className="cursor-help"
                >
                  <Badge variant="outline" className={`${scoreTone(r.performance)} text-xs`}>
                    P {r.performance}
                  </Badge>
                </Hint>
                <Hint text={`SEO: ${r.seo} / 100`} className="cursor-help">
                  <Badge variant="outline" className={`${scoreTone(r.seo)} text-xs`}>
                    S {r.seo}
                  </Badge>
                </Hint>
                <span
                  className="text-muted-foreground ml-1 hidden sm:inline"
                  title={formatDateTime(r.requestedAt)}
                >
                  · {r.overall}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CommonFailuresList({
  rows,
  onApply,
}: {
  rows: AuditSummary["commonFailures"]
  onApply?: (id: string) => void
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-medium mb-2">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
        <span>Common failures</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No recurring failures.</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-2 border rounded-md px-2 py-1.5"
            >
              <button
                type="button"
                onClick={() => onApply?.(r.title)}
                className="text-xs text-left truncate hover:underline"
                title={`Filter history to "${r.title}"`}
              >
                {r.title}
              </button>
              <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                {r.urlsAffected} {r.urlsAffected === 1 ? "page" : "pages"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
