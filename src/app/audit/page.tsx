"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  ExternalLink,
  Smartphone,
  Monitor,
  Globe,
} from "lucide-react"
import { LighthouseGauges } from "@/components/audit/lighthouse-gauges"
import { AuditDetail } from "@/components/audit/audit-detail"
import { AuditSummaryCard } from "@/components/audit/summary-card"
import {
  HistoryFilterBar,
  type DateWindow,
  type StatusFilter,
  type ViewMode,
} from "@/components/audit/history-filter-bar"
import { PageNav } from "@/components/ui/page-nav"
import { Hint } from "@/components/ui/hint"
import { formatDateTime } from "@/lib/format"
import { PageBreadcrumbs } from "@/components/page-breadcrumbs"
import type {
  Audit,
  AuditResult,
  AuditStatus,
  AuditStrategy,
} from "@/types/audit"

const PAGE_SIZE = 20
const STRATEGY_STORAGE_KEY = "audit-form-strategy"

interface DetailResponse {
  audit: Audit
  prior: Audit | null
}

interface FlatResponse {
  view: "flat"
  rows: Audit[]
  total: number
}

interface GroupedResponse {
  view: "grouped"
  rows: { url: string; count: number; latest: Audit }[]
  total: number
}

interface DomainResponse {
  view: "domain"
  rows: {
    hostname: string
    audits: number
    urls: number
    latest: Audit
  }[]
  total: number
}

type ListResponse = FlatResponse | GroupedResponse | DomainResponse

export default function AuditPage() {
  // useSearchParams forces a Suspense boundary on Next.js 16 client pages,
  // otherwise the build emits "useSearchParams should be wrapped in a
  // suspense boundary" warnings. Same pattern as /login.
  return (
    <Suspense fallback={null}>
      <AuditPageInner />
    </Suspense>
  )
}

function AuditPageInner() {
  const router = useRouter()
  const sp = useSearchParams()

  // URL-bound filter / pager state. Keeping the URL as source-of-truth means
  // the user can bookmark or share an exact view of the history list.
  const search = sp.get("q") ?? ""
  const status = (sp.get("status") as StatusFilter | null) ?? "all"
  const since = (sp.get("since") as DateWindow | null) ?? "30d"
  // Default view is `domain` — hostnames are the most useful first-level
  // grouping when scanning months of audits. Flat / URL views are opt-in.
  const rawView = sp.get("view")
  const view: ViewMode =
    rawView === "flat"
      ? "flat"
      : rawView === "grouped"
        ? "grouped"
        : "domain"
  const page = Math.max(Number(sp.get("page") ?? "1"), 1)

  // Strategy is a form preference, not a shareable view filter — localStorage,
  // not URL.
  const [strategy, setStrategyState] = useState<AuditStrategy>("mobile")
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STRATEGY_STORAGE_KEY)
      if (stored === "desktop" || stored === "mobile") setStrategyState(stored)
    } catch {
      /* localStorage can be unavailable (private mode, SSR) — ignore. */
    }
  }, [])
  const setStrategy = (v: AuditStrategy) => {
    setStrategyState(v)
    try {
      window.localStorage.setItem(STRATEGY_STORAGE_KEY, v)
    } catch {
      /* ignore */
    }
  }

  function pushUrl(patch: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k)
      else next.set(k, v)
    }
    // Any filter / view change resets pagination. The pager itself sets
    // ?page=N explicitly so a `page` key in `patch` overrides this default.
    if (!("page" in patch)) next.delete("page")
    const qs = next.toString()
    router.replace(qs ? `/audit?${qs}` : "/audit")
  }

  // ─── Form state ────────────────────────────────────────────────────────
  const [url, setUrl] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchText, setBatchText] = useState("")
  const [batchSubmitting, setBatchSubmitting] = useState(false)
  const [batchInfo, setBatchInfo] = useState<string | null>(null)

  // ─── List state ────────────────────────────────────────────────────────
  const [data, setData] = useState<ListResponse | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [details, setDetails] = useState<Record<number, DetailResponse>>({})

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Build the query string once per render so loadAudits + the polling effect
  // can share it without drifting.
  const apiQuery = useMemo(() => {
    const p = new URLSearchParams()
    p.set("view", view)
    p.set("limit", String(PAGE_SIZE))
    p.set("page", String(page))
    if (search) p.set("q", search)
    if (status !== "all") p.set("status", status)
    if (since !== "all") p.set("since", since)
    return p.toString()
  }, [view, page, search, status, since])

  const loadAudits = useCallback(async () => {
    const res = await fetch(`/api/audit?${apiQuery}`)
    if (!res.ok) return
    setData((await res.json()) as ListResponse)
  }, [apiQuery])

  useEffect(() => {
    loadAudits()
  }, [loadAudits])

  // Poll while any audit on the current page is pending or running. Polls the
  // current query so freshly-completed rows show up in place without the user
  // having to refresh.
  useEffect(() => {
    const rows = data?.rows ?? []
    const inFlight = rows.some((r) => {
      const a = "latest" in r ? r.latest : (r as Audit)
      return a.status === "pending" || a.status === "running"
    })
    if (inFlight && !pollTimer.current) {
      pollTimer.current = setInterval(loadAudits, 2000)
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

  async function submit() {
    if (!url.trim()) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), strategy }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setSubmitError(body.error ?? `Request failed (${res.status})`)
        return
      }
      setUrl("")
      loadAudits()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Network error")
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleExpand(audit: Audit) {
    if (expanded === audit.id) {
      setExpanded(null)
      return
    }
    setExpanded(audit.id)
    if (audit.status === "done" && !details[audit.id]) {
      const res = await fetch(`/api/audit/${audit.id}`)
      if (res.ok) {
        const body = (await res.json()) as DetailResponse
        setDetails((d) => ({ ...d, [audit.id]: body }))
      }
    }
  }

  async function deleteAudit(id: number) {
    if (!confirm("Delete this audit?")) return
    await fetch(`/api/audit/${id}`, { method: "DELETE" })
    loadAudits()
  }

  async function retryAudit(targetUrl: string, retryStrategy: AuditStrategy) {
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl, strategy: retryStrategy }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        alert(body.error ?? `Retry failed (${res.status})`)
        return
      }
      loadAudits()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Network error")
    }
  }

  async function submitBatch() {
    const urls = batchText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (urls.length === 0) return
    setBatchSubmitting(true)
    setBatchInfo(null)
    try {
      const res = await fetch("/api/audit/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls, strategy }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setBatchInfo(body.error ?? `Request failed (${res.status})`)
        return
      }
      const queued = Array.isArray(body.ids) ? body.ids.length : 0
      const skipped = Array.isArray(body.skipped) ? body.skipped.length : 0
      setBatchInfo(
        skipped > 0
          ? `Queued ${queued} audit(s); skipped ${skipped} invalid URL(s).`
          : `Queued ${queued} audit(s).`
      )
      setBatchText("")
      loadAudits()
    } catch (err) {
      setBatchInfo(err instanceof Error ? err.message : "Network error")
    } finally {
      setBatchSubmitting(false)
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <PageBreadcrumbs
          items={[{ label: "Dashboard", href: "/" }, { label: "Audit" }]}
        />
        <h1 className="text-xl font-semibold">SEO audit</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Run an audit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Paste any URL — yours or a competitor&apos;s — and we&apos;ll run a Lighthouse-style
            on-page audit via Google PageSpeed Insights. Audits queue and run in the
            background; you can navigate away while one is in flight.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              suppressHydrationWarning
              className="flex-1 border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="https://example.com/some-page"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <div className="flex items-center gap-2">
              <StrategyToggle value={strategy} onChange={setStrategy} />
              <Button size="sm" onClick={submit} disabled={submitting}>
                <Search className="w-3.5 h-3.5 mr-1.5" />
                Audit
              </Button>
            </div>
          </div>
          {submitError && <p className="text-xs text-destructive">{submitError}</p>}

          <div className="pt-2 border-t">
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              onClick={() => setBatchOpen((o) => !o)}
            >
              {batchOpen ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              Audit a list of URLs
            </button>
            {batchOpen && (
              <div className="mt-3 space-y-2">
                <textarea
                  suppressHydrationWarning
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                  rows={6}
                  placeholder={"https://example.com/a\nhttps://example.com/b\nhttps://competitor.com/foo"}
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={submitBatch}
                    disabled={batchSubmitting || !batchText.trim()}
                  >
                    Audit all
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    One URL per line; max 50. Uses the strategy selected above.
                  </span>
                </div>
                {batchInfo && (
                  <p className="text-xs text-muted-foreground">{batchInfo}</p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <AuditSummaryCard
        onApplyCommonFailureFilter={(needle) => pushUrl({ q: needle })}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <HistoryFilterBar
            search={search}
            onSearchChange={(v) => pushUrl({ q: v || null })}
            status={status}
            onStatusChange={(v) => pushUrl({ status: v === "all" ? null : v })}
            since={since}
            onSinceChange={(v) => pushUrl({ since: v })}
            view={view}
            onViewChange={(v) =>
              // `domain` is the implicit default — drop the query param
              // entirely when the user picks it so URLs stay clean.
              pushUrl({ view: v === "domain" ? null : v })
            }
          />

          {!data ? (
            <p className="text-sm text-muted-foreground py-4">Loading…</p>
          ) : data.total === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              {search || status !== "all" || since !== "30d"
                ? "No audits match these filters."
                : "No audits yet. Submit a URL above to get started."}
            </p>
          ) : data.view === "domain" ? (
            <DomainList rows={data.rows} />
          ) : data.view === "grouped" ? (
            <GroupedList rows={data.rows} />
          ) : (
            <ul className="space-y-2">
              {data.rows.map((a) => (
                <AuditRow
                  key={a.id}
                  audit={a}
                  expanded={expanded === a.id}
                  detail={details[a.id]}
                  onToggle={() => toggleExpand(a)}
                  onDelete={() => deleteAudit(a.id)}
                  onRetry={() => retryAudit(a.url, a.strategy ?? "mobile")}
                />
              ))}
            </ul>
          )}

          <PageNav
            page={page}
            totalPages={totalPages}
            onPageChange={(p) => pushUrl({ page: String(p) })}
          />
        </CardContent>
      </Card>
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
  const items: { key: AuditStrategy; label: string; icon: typeof Smartphone }[] = [
    { key: "mobile", label: "Mobile", icon: Smartphone },
    { key: "desktop", label: "Desktop", icon: Monitor },
  ]
  return (
    <div className="inline-flex items-center rounded-md border overflow-hidden text-xs shrink-0">
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
              "px-2.5 py-1.5 inline-flex items-center gap-1 transition-colors " +
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

function DomainList({
  rows,
}: {
  rows: {
    hostname: string
    audits: number
    urls: number
    latest: Audit
  }[]
}) {
  const router = useRouter()
  const sp = useSearchParams()

  // Clicking a domain row drills down to the URL-grouped view, pre-filtered
  // to that hostname via the search query. Keeps the URL bound + shareable
  // and reuses the existing grouped renderer.
  function drillTo(hostname: string) {
    const next = new URLSearchParams(sp.toString())
    next.set("view", "grouped")
    next.set("q", hostname)
    next.delete("page")
    router.replace(`/audit?${next.toString()}`)
  }

  return (
    <ul className="space-y-2">
      {rows.map((g) => {
        const result =
          g.latest.result_json && g.latest.status === "done"
            ? (JSON.parse(g.latest.result_json) as AuditResult)
            : null
        return (
          <li
            key={g.hostname}
            className="border rounded-md px-3 py-2 hover:bg-muted/40 cursor-pointer transition-colors"
            onClick={() => drillTo(g.hostname)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                drillTo(g.hostname)
              }
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 min-w-0 flex-1">
                <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium truncate" title={g.hostname}>
                  {g.hostname}
                </span>
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="text-xs">
                  {g.audits} {g.audits === 1 ? "audit" : "audits"}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {g.urls} {g.urls === 1 ? "URL" : "URLs"}
                </Badge>
                {result && (
                  <div className="hidden sm:block">
                    <ScorePills result={result} />
                  </div>
                )}
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Latest: {formatDateTime(g.latest.requested_at)} · {g.latest.status}
            </p>
          </li>
        )
      })}
    </ul>
  )
}

function GroupedList({
  rows,
}: {
  rows: { url: string; count: number; latest: Audit }[]
}) {
  return (
    <ul className="space-y-2">
      {rows.map((g) => {
        const result =
          g.latest.result_json && g.latest.status === "done"
            ? (JSON.parse(g.latest.result_json) as AuditResult)
            : null
        return (
          <li key={g.url} className="border rounded-md px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <Link
                href={`/audit/url?u=${encodeURIComponent(g.url)}`}
                className="text-sm font-medium truncate hover:underline"
              >
                {g.url}
              </Link>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="text-xs">
                  {g.count} {g.count === 1 ? "audit" : "audits"}
                </Badge>
                {result && (
                  <div className="hidden sm:block">
                    <ScorePills result={result} />
                  </div>
                )}
                <Link
                  href={`/audit/url?u=${encodeURIComponent(g.url)}`}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Open audit history for this URL"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Latest: {formatDateTime(g.latest.requested_at)} · {g.latest.status}
            </p>
          </li>
        )
      })}
    </ul>
  )
}

function StatusBadge({ status }: { status: AuditStatus }) {
  if (status === "pending" || status === "running") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        {status === "pending" ? "queued" : "running"}
      </span>
    )
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-600">
        <XCircle className="w-3.5 h-3.5" />
        failed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-green-600">
      <CheckCircle2 className="w-3.5 h-3.5" />
      done
    </span>
  )
}

function ScorePills({ result }: { result: AuditResult }) {
  const items: { label: string; full: string; value: number }[] = [
    { label: "P", full: "Performance", value: result.scores.performance },
    { label: "A", full: "Accessibility", value: result.scores.accessibility },
    { label: "BP", full: "Best Practices", value: result.scores.bestPractices },
    { label: "S", full: "SEO", value: result.scores.seo },
  ]
  return (
    <div className="flex gap-1">
      {items.map((it) => {
        const colour =
          it.value >= 90
            ? "bg-green-100 text-green-700 border-green-300"
            : it.value >= 50
              ? "bg-amber-100 text-amber-700 border-amber-300"
              : "bg-red-100 text-red-700 border-red-300"
        return (
          <Hint
            key={it.label}
            text={`${it.full}: ${it.value} / 100`}
            className={`text-xs border rounded-md px-1.5 py-0.5 font-medium cursor-help ${colour}`}
          >
            {it.label} {it.value}
          </Hint>
        )
      })}
    </div>
  )
}

function StrategyChip({ strategy }: { strategy: AuditStrategy }) {
  const Icon = strategy === "desktop" ? Monitor : Smartphone
  return (
    <Hint text={`${strategy} audit`} className="cursor-help">
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
    </Hint>
  )
}

function AuditRow({
  audit,
  expanded,
  detail,
  onToggle,
  onDelete,
  onRetry,
}: {
  audit: Audit
  expanded: boolean
  detail: DetailResponse | undefined
  onToggle: () => void
  onDelete: () => void
  onRetry: () => void
}) {
  const ts = formatDateTime(audit.requested_at)
  const result =
    audit.result_json && audit.status === "done"
      ? (JSON.parse(audit.result_json) as AuditResult)
      : null
  const priorResult =
    detail?.prior?.result_json
      ? (JSON.parse(detail.prior.result_json) as AuditResult)
      : undefined

  return (
    <li className="border rounded-md">
      <div className="flex items-center justify-between px-3 py-2">
        <button
          type="button"
          className="flex items-center gap-2 flex-1 text-left min-w-0"
          onClick={onToggle}
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 shrink-0" />
          )}
          <StrategyChip strategy={audit.strategy ?? "mobile"} />
          <span className="text-sm font-medium truncate">{audit.url}</span>
        </button>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {result && (
            <div className="hidden sm:block">
              <ScorePills result={result} />
            </div>
          )}
          <StatusBadge status={audit.status} />
          <span className="text-xs text-muted-foreground hidden md:inline">
            {ts}
          </span>
          <Link
            href={`/audit/url?u=${encodeURIComponent(audit.url)}`}
            className="text-muted-foreground hover:text-foreground"
            aria-label="View all audits for this URL"
            title="View all audits for this URL"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          {audit.status === "error" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetry}
              aria-label="Retry audit"
              title="Retry audit"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
            aria-label="Delete audit"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t p-3 space-y-4 bg-muted/30">
          {audit.status === "error" && (
            <div className="space-y-2">
              <p className="text-sm text-red-600">
                Audit failed: {audit.error_message ?? "unknown error"}
              </p>
              <Button size="sm" variant="outline" onClick={onRetry}>
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Retry
              </Button>
            </div>
          )}
          {(audit.status === "pending" || audit.status === "running") && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              PageSpeed Insights is running in the background. This usually takes
              15–30 seconds.
            </div>
          )}
          {result && (
            <>
              <LighthouseGauges current={result} prior={priorResult} />
              <AuditDetail current={result} prior={priorResult} />
              {detail?.prior && (
                <p className="text-xs text-muted-foreground">
                  Diff baseline: {formatDateTime(detail.prior.requested_at)}
                </p>
              )}
              {!detail?.prior && (
                <p className="text-xs text-muted-foreground">
                  First audit for this URL — re-run later to see deltas.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Final URL: <Badge variant="outline">{result.finalUrl}</Badge>
              </p>
            </>
          )}
        </div>
      )}
    </li>
  )
}
