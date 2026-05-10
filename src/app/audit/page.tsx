"use client"

import { useEffect, useRef, useState } from "react"
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
} from "lucide-react"
import { LighthouseGauges } from "@/components/audit/lighthouse-gauges"
import { AuditDetail } from "@/components/audit/audit-detail"
import type { Audit, AuditResult } from "@/types/audit"

interface DetailResponse {
  audit: Audit
  prior: Audit | null
}

export default function AuditPage() {
  const [audits, setAudits] = useState<Audit[]>([])
  const [url, setUrl] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [details, setDetails] = useState<Record<number, DetailResponse>>({})
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchText, setBatchText] = useState("")
  const [batchSubmitting, setBatchSubmitting] = useState(false)
  const [batchInfo, setBatchInfo] = useState<string | null>(null)

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  async function loadAudits() {
    const res = await fetch("/api/audit")
    setAudits(await res.json())
  }

  useEffect(() => {
    loadAudits()
  }, [])

  // Poll while any audit is pending or running.
  useEffect(() => {
    const inFlight = audits.some(
      (a) => a.status === "pending" || a.status === "running"
    )
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
  }, [audits])

  async function submit() {
    if (!url.trim()) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
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

  /**
   * Re-run a failed audit. We don't mutate the failed row; instead we POST a
   * new audit for the same URL so the failure stays as history and the
   * retry surfaces as a fresh "pending" entry at the top of the list.
   */
  async function retryAudit(targetUrl: string) {
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
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
        body: JSON.stringify({ urls }),
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

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-xl font-semibold">SEO audit</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Run an audit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Paste any URL — yours or a competitor's — and we&apos;ll run a Lighthouse-style
            on-page audit via Google PageSpeed Insights. Audits queue and run in the
            background; you can navigate away while one is in flight.
          </p>
          <div className="flex gap-2">
            <input
              className="flex-1 border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="https://example.com/some-page"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <Button size="sm" onClick={submit} disabled={submitting}>
              <Search className="w-3.5 h-3.5 mr-1.5" />
              Audit
            </Button>
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
                    One URL per line; max 50.
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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">History</CardTitle>
        </CardHeader>
        <CardContent>
          {audits.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No audits yet. Submit a URL above to get started.
            </p>
          ) : (
            <ul className="space-y-2">
              {audits.map((a) => (
                <AuditRow
                  key={a.id}
                  audit={a}
                  expanded={expanded === a.id}
                  detail={details[a.id]}
                  onToggle={() => toggleExpand(a)}
                  onDelete={() => deleteAudit(a.id)}
                  onRetry={() => retryAudit(a.url)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatusBadge({ status }: { status: Audit["status"] }) {
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
          <span
            key={it.label}
            className={`text-xs border rounded-md px-1.5 py-0.5 font-medium cursor-help ${colour}`}
            title={`${it.full}: ${it.value} / 100`}
          >
            {it.label} {it.value}
          </span>
        )
      })}
    </div>
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
  const ts = new Date(audit.requested_at * 1000).toLocaleString()
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
                  Diff baseline:{" "}
                  {new Date(detail.prior.requested_at * 1000).toLocaleString()}
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
