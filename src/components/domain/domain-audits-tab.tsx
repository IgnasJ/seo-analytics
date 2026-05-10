"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Smartphone,
  Monitor,
  Sparkles,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageNav } from "@/components/ui/page-nav"
import { Hint } from "@/components/ui/hint"
import { formatDateTime } from "@/lib/format"
import type {
  Audit,
  AuditResult,
  AuditStatus,
  AuditStrategy,
} from "@/types/audit"

const PAGE_SIZE = 15

interface Props {
  domainId: number
  hostname: string
  hasGscTopPages: boolean
}

interface ListResponse {
  rows: Audit[]
  total: number
}

/**
 * Audits tab on `/domain/[id]`. Lists audits whose URL hostname matches the
 * domain plus a "Audit top N pages" action that batches the GSC top-clicked
 * URLs through PSI.
 */
export function DomainAuditsTab({ domainId, hostname, hasGscTopPages }: Props) {
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ListResponse | null>(null)
  const [n, setN] = useState(10)
  const [strategy, setStrategy] = useState<AuditStrategy>("mobile")
  const [submitting, setSubmitting] = useState(false)
  const [info, setInfo] = useState<string | null>(null)

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadAudits = useCallback(async () => {
    const params = new URLSearchParams({
      hostname,
      limit: String(PAGE_SIZE),
      page: String(page),
    })
    const res = await fetch(`/api/audit/by-host?${params.toString()}`)
    if (!res.ok) return
    setData((await res.json()) as ListResponse)
  }, [hostname, page])

  useEffect(() => {
    loadAudits()
  }, [loadAudits])

  useEffect(() => {
    const rows = data?.rows ?? []
    const inFlight = rows.some(
      (a) => a.status === "pending" || a.status === "running"
    )
    if (inFlight && !pollTimer.current) {
      pollTimer.current = setInterval(loadAudits, 2500)
    } else if (!inFlight && pollTimer.current) {
      clearInterval(pollTimer.current)
      pollTimer.current = null
    }
    return () => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current)
        pollTimer.current = null
      }
    }
  }, [data, loadAudits])

  async function batchTopPages() {
    setSubmitting(true)
    setInfo(null)
    try {
      const res = await fetch(`/api/domains/${domainId}/audit-top-pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n, strategy }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setInfo(body.error ?? `Request failed (${res.status})`)
        return
      }
      const queued = typeof body.queued === "number" ? body.queued : 0
      setInfo(
        queued > 0
          ? `Queued ${queued} audit${queued === 1 ? "" : "s"} — they'll appear below as they finish.`
          : "Nothing to audit."
      )
      // Jump back to page 1 so the new pending rows are visible.
      setPage(1)
      loadAudits()
    } catch (err) {
      setInfo(err instanceof Error ? err.message : "Network error")
    } finally {
      setSubmitting(false)
    }
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const lastAt = data?.rows[0]?.requested_at ?? null

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border rounded-md px-3 py-2">
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground tabular-nums">{total}</span>{" "}
          audit{total === 1 ? "" : "s"} on this domain
          {lastAt && (
            <>
              {" · last "}
              <span className="font-mono tabular-nums">
                {formatDateTime(lastAt)}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Hint
            text="Number of top GSC-clicked pages to audit in this batch."
            className="cursor-help"
          >
            <label className="text-xs text-muted-foreground inline-flex items-center gap-1">
              N=
              <input
                type="number"
                min={1}
                max={25}
                value={n}
                onChange={(e) =>
                  setN(Math.min(Math.max(Number(e.target.value) || 1, 1), 25))
                }
                className="w-12 border rounded px-1 py-0.5 text-xs tabular-nums"
              />
            </label>
          </Hint>
          <StrategyToggle value={strategy} onChange={setStrategy} />
          <Button
            size="sm"
            onClick={batchTopPages}
            disabled={submitting || !hasGscTopPages}
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            )}
            Audit top {n} pages
          </Button>
        </div>
      </div>

      {!hasGscTopPages && (
        <div className="border border-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded-md px-3 py-2 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            No Search Console top-pages data cached yet. Sync this domain first
            so we know which URLs to audit.
          </span>
        </div>
      )}

      {info && (
        <p className="text-xs text-muted-foreground">{info}</p>
      )}

      {!data ? (
        <p className="text-sm text-muted-foreground py-4">Loading…</p>
      ) : data.total === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          No audits for this domain yet. Use the button above to batch-audit
          your top pages, or paste a URL on the{" "}
          <Link href="/audit" className="underline">
            Audit
          </Link>{" "}
          tab.
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {data.rows.map((a) => (
              <DomainAuditRow key={a.id} audit={a} />
            ))}
          </ul>
          <PageNav
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  )
}

function StrategyToggle({
  value,
  onChange,
}: {
  value: AuditStrategy
  onChange: (v: AuditStrategy) => void
}) {
  const items: { key: AuditStrategy; icon: typeof Smartphone; label: string }[] = [
    { key: "mobile", icon: Smartphone, label: "Mobile" },
    { key: "desktop", icon: Monitor, label: "Desktop" },
  ]
  return (
    <div className="inline-flex items-center rounded-md border overflow-hidden text-xs">
      {items.map((it) => {
        const active = it.key === value
        const Icon = it.icon
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            aria-pressed={active}
            className={
              "px-2 py-1.5 inline-flex items-center gap-1 transition-colors " +
              (active ? "bg-foreground text-background" : "hover:bg-muted")
            }
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{it.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function DomainAuditRow({ audit }: { audit: Audit }) {
  const result =
    audit.result_json && audit.status === "done"
      ? (JSON.parse(audit.result_json) as AuditResult)
      : null
  return (
    <li className="border rounded-md px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/audit/url?u=${encodeURIComponent(audit.url)}`}
          className="text-sm font-medium truncate hover:underline min-w-0 flex-1"
          title={audit.url}
        >
          {audit.url}
        </Link>
        <div className="flex items-center gap-2 shrink-0">
          {result && <ScorePills result={result} />}
          <StatusBadge status={audit.status} />
          <Link
            href={`/audit/url?u=${encodeURIComponent(audit.url)}`}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Open audit history for this URL"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-1 tabular-nums">
        {formatDateTime(audit.requested_at)} · {audit.strategy ?? "mobile"}
      </p>
    </li>
  )
}

function StatusBadge({ status }: { status: AuditStatus }) {
  if (status === "pending" || status === "running") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" />
        {status === "pending" ? "queued" : "running"}
      </span>
    )
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-600">
        <XCircle className="w-3 h-3" />
        error
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-green-600">
      <CheckCircle2 className="w-3 h-3" />
      done
    </span>
  )
}

function ScorePills({ result }: { result: AuditResult }) {
  const items: { label: string; full: string; value: number }[] = [
    { label: "P", full: "Performance", value: result.scores.performance },
    { label: "S", full: "SEO", value: result.scores.seo },
  ]
  return (
    <div className="hidden sm:flex gap-1">
      {items.map((it) => {
        const colour =
          it.value >= 90
            ? "bg-green-100 text-green-700 border-green-300"
            : it.value >= 50
              ? "bg-amber-100 text-amber-700 border-amber-300"
              : "bg-red-100 text-red-700 border-red-300"
        return (
          <Badge
            key={it.label}
            variant="outline"
            className={`text-xs ${colour}`}
            title={`${it.full}: ${it.value}/100`}
          >
            {it.label} {it.value}
          </Badge>
        )
      })}
    </div>
  )
}
