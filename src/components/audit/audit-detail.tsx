"use client"

import { useState } from "react"
import type { AuditCategory, AuditEntry, AuditResult } from "@/types/audit"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronRight, CheckCircle2, AlertCircle, XCircle } from "lucide-react"

const CATEGORY_LABEL: Record<AuditCategory, string> = {
  performance: "Performance",
  accessibility: "Accessibility",
  "best-practices": "Best practices",
  seo: "SEO",
}

const CATEGORY_ORDER: AuditCategory[] = ["seo", "performance", "accessibility", "best-practices"]

function severityIcon(s: AuditEntry["severity"]) {
  if (s === "pass") return <CheckCircle2 className="w-4 h-4 text-green-600" />
  if (s === "warn") return <AlertCircle className="w-4 h-4 text-amber-600" />
  return <XCircle className="w-4 h-4 text-red-600" />
}

interface Props {
  current: AuditResult
  prior?: AuditResult
}

export function AuditDetail({ current, prior }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({
    seo: true,
    performance: false,
    accessibility: false,
    "best-practices": false,
  })

  const grouped: Record<AuditCategory, AuditEntry[]> = {
    performance: [],
    accessibility: [],
    "best-practices": [],
    seo: [],
  }
  for (const a of current.audits) grouped[a.category].push(a)
  for (const cat of CATEGORY_ORDER) {
    grouped[cat].sort((a, b) => {
      // Failures first, then warns, then passes; stable within groups.
      const order = { fail: 0, warn: 1, pass: 2 } as const
      return order[a.severity] - order[b.severity]
    })
  }

  // Build a quick lookup for prior audit entries to render delta hints.
  const priorIndex = new Map<string, AuditEntry>()
  if (prior) for (const a of prior.audits) priorIndex.set(a.id, a)

  return (
    <div className="space-y-3">
      {/* Lab CWV strip - useful at-a-glance even with the full sections below */}
      <LabCwvStrip current={current} prior={prior} />

      {CATEGORY_ORDER.map((cat) => {
        const entries = grouped[cat]
        if (entries.length === 0) return null
        const fails = entries.filter((e) => e.severity === "fail").length
        const warns = entries.filter((e) => e.severity === "warn").length
        return (
          <section key={cat} className="border rounded-md">
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50"
              onClick={() => setOpen((o) => ({ ...o, [cat]: !o[cat] }))}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                {open[cat] ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                {CATEGORY_LABEL[cat]}
              </span>
              <span className="flex items-center gap-2 text-xs">
                {fails > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {fails} failing
                  </Badge>
                )}
                {warns > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {warns} warn
                  </Badge>
                )}
                <span className="text-muted-foreground">{entries.length} checks</span>
              </span>
            </button>
            {open[cat] && (
              <ul className="border-t divide-y">
                {entries.map((e) => {
                  const before = priorIndex.get(e.id)
                  const changed =
                    before && before.severity !== e.severity
                      ? ` (${before.severity} → ${e.severity})`
                      : ""
                  return (
                    <li key={e.id} className="px-3 py-2 text-sm">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5">{severityIcon(e.severity)}</span>
                        <div className="flex-1">
                          <p className="font-medium">
                            {e.title}
                            {e.displayValue && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                {e.displayValue}
                              </span>
                            )}
                            {changed && (
                              <span
                                className={
                                  "ml-2 text-xs font-normal " +
                                  (before && order(before.severity) > order(e.severity)
                                    ? "text-green-600"
                                    : "text-red-600")
                                }
                              >
                                {changed}
                              </span>
                            )}
                          </p>
                          {e.severity !== "pass" && e.description && (
                            <p
                              className="text-xs text-muted-foreground mt-1"
                              dangerouslySetInnerHTML={{ __html: stripMarkdownLinks(e.description) }}
                            />
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

function order(s: AuditEntry["severity"]): number {
  return s === "fail" ? 0 : s === "warn" ? 1 : 2
}

// Lighthouse audit descriptions arrive as Markdown with `[text](url)` links.
// Convert to plain HTML anchors so they render rather than showing brackets.
function stripMarkdownLinks(s: string): string {
  return s.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener" class="underline">$1</a>'
  )
}

function LabCwvStrip({ current, prior }: Props) {
  function fmtMs(v: number | null): string {
    if (v == null) return "—"
    return v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`
  }
  function fmtCls(v: number | null): string {
    return v == null ? "—" : v.toFixed(3)
  }
  function delta(curr: number | null, prev: number | null, lowerIsBetter: boolean) {
    if (curr == null || prev == null) return null
    const d = curr - prev
    if (Math.abs(d) < 0.0001) return null
    const better = lowerIsBetter ? d < 0 : d > 0
    return { d, better }
  }
  const items: {
    label: string
    tooltip: string
    current: string
    raw: number | null
    prior: number | null
    cls?: boolean
  }[] = [
    {
      label: "LCP",
      tooltip:
        "Largest Contentful Paint — time until the largest visible element renders. Target <2.5 s. Hero images, slow servers, render-blocking JS or CSS are the usual culprits.",
      current: fmtMs(current.labCwv.lcp),
      raw: current.labCwv.lcp,
      prior: prior?.labCwv.lcp ?? null,
    },
    {
      label: "CLS",
      tooltip:
        "Cumulative Layout Shift — how much the page jumps around as it loads (unitless score). Target <0.1. Caused by missing image dimensions, late-injected content, or font swaps.",
      current: fmtCls(current.labCwv.cls),
      raw: current.labCwv.cls,
      prior: prior?.labCwv.cls ?? null,
      cls: true,
    },
    {
      label: "TBT",
      tooltip:
        "Total Blocking Time — total ms the main thread was busy enough to block input. Target <200 ms. Lab equivalent of INP. Heavy third-party scripts and large JS bundles drive this.",
      current: fmtMs(current.labCwv.tbt),
      raw: current.labCwv.tbt,
      prior: prior?.labCwv.tbt ?? null,
    },
    {
      label: "FCP",
      tooltip:
        "First Contentful Paint — time to render the first piece of text or image. Target <1.8 s. Server response time and render-blocking CSS dominate this metric.",
      current: fmtMs(current.labCwv.fcp),
      raw: current.labCwv.fcp,
      prior: prior?.labCwv.fcp ?? null,
    },
    {
      label: "SI",
      tooltip:
        "Speed Index — how quickly content visually populates above the fold (calculated from a video timeline of the load). Target <3.4 s.",
      current: fmtMs(current.labCwv.si),
      raw: current.labCwv.si,
      prior: prior?.labCwv.si ?? null,
    },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs border rounded-md p-3">
      {items.map((it) => {
        const d = delta(it.raw, it.prior, true) // lab metrics: lower is better
        return (
          <div key={it.label} className="flex flex-col">
            <span
              title={it.tooltip}
              className="text-muted-foreground cursor-help"
            >
              {it.label}
            </span>
            <span className="font-medium">{it.current}</span>
            {d && (
              <span className={d.better ? "text-green-600" : "text-red-600"}>
                {it.cls ? d.d.toFixed(3) : Math.round(d.d) + " ms"}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
