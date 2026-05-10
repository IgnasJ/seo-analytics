"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  RefreshCw,
  ExternalLink,
  Loader2,
  Globe,
  Smartphone,
  Monitor,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Hint } from "@/components/ui/hint"
import type { AuditStrategy } from "@/types/audit"
import type { Domain } from "@/lib/db/queries/domains"

interface Props {
  url: string
  domain: Domain | null
  strategyDefault: AuditStrategy
}

/**
 * Sticky-feeling header strip on `/audit/url`. Shows the URL, the matched
 * tracked-domain badge if any, the strategy toggle for the next re-audit,
 * and the action buttons (Audit now · View domain · Open original).
 */
export function UrlAuditHeader({ url, domain, strategyDefault }: Props) {
  const router = useRouter()
  const [strategy, setStrategy] = useState<AuditStrategy>(strategyDefault)
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState<string | null>(null)

  async function reAudit() {
    setSubmitting(true)
    setSubmitMsg(null)
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, strategy }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setSubmitMsg(body.error ?? `Request failed (${res.status})`)
        return
      }
      setSubmitMsg("Queued. This page will update when it finishes.")
      // Refresh the server payload (audits list) every few seconds until the
      // new audit lands. Cheaper than client-side polling because the server
      // already handles dedup + ordering.
      const t = setInterval(() => router.refresh(), 3000)
      // Stop polling after ~90 s — PSI usually completes within 30 s.
      setTimeout(() => clearInterval(t), 90_000)
    } catch (err) {
      setSubmitMsg(err instanceof Error ? err.message : "Network error")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold truncate" title={url}>
              {url}
            </h1>
            {domain && (
              <Hint
                text={`Tracked domain: ${domain.hostname}. Click to open the domain dashboard.`}
                className="cursor-help"
              >
                <Link href={`/domain/${domain.id}`}>
                  <Badge
                    variant="outline"
                    className="text-xs inline-flex items-center gap-1"
                  >
                    <Globe className="w-3 h-3" />
                    {domain.hostname}
                  </Badge>
                </Link>
              </Hint>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            All audits ever run on this URL — across both strategies.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StrategyToggle value={strategy} onChange={setStrategy} />
          <Button size="sm" onClick={reAudit} disabled={submitting}>
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            )}
            Audit now
          </Button>
          <Hint text="Open URL in new tab" className="cursor-help">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-8 h-8 rounded-md border hover:bg-muted text-muted-foreground"
              aria-label="Open URL in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </Hint>
        </div>
      </div>
      {submitMsg && (
        <p className="text-xs text-muted-foreground">{submitMsg}</p>
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
  const items: { key: AuditStrategy; label: string; icon: typeof Smartphone }[] = [
    { key: "mobile", label: "Mobile", icon: Smartphone },
    { key: "desktop", label: "Desktop", icon: Monitor },
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
