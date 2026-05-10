"use client"

import { useMemo, useState } from "react"
import type { AuditCategory, AuditEntry, AuditResult } from "@/types/audit"
import { Badge } from "@/components/ui/badge"
import { Hint } from "@/components/ui/hint"
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from "lucide-react"

const CATEGORY_LABEL: Record<AuditCategory, string> = {
  performance: "Performance",
  accessibility: "Accessibility",
  "best-practices": "Best practices",
  seo: "SEO",
}

const CATEGORY_ORDER: AuditCategory[] = [
  "seo",
  "performance",
  "accessibility",
  "best-practices",
]

type SeverityFilter = "all" | "fail" | "warn" | "pass"

function severityIcon(s: AuditEntry["severity"]) {
  if (s === "pass") return <CheckCircle2 className="w-4 h-4 text-green-600" />
  if (s === "warn") return <AlertCircle className="w-4 h-4 text-amber-600" />
  return <XCircle className="w-4 h-4 text-red-600" />
}

interface Props {
  current: AuditResult
  prior?: AuditResult
  /** When provided, severity filter chips switch from internal state to
   *  parent-controlled state. Used by `/audit/url` where the filter is URL-bound. */
  severityFilter?: SeverityFilter
  onSeverityFilterChange?: (v: SeverityFilter) => void
}

export function AuditDetail({
  current,
  prior,
  severityFilter,
  onSeverityFilterChange,
}: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({
    seo: true,
    performance: false,
    accessibility: false,
    "best-practices": false,
  })

  // Controlled vs uncontrolled severity filter. URL-detail page supplies its
  // own; the inline expansion on /audit owns it internally.
  const [localFilter, setLocalFilter] = useState<SeverityFilter>("all")
  const filter = severityFilter ?? localFilter
  const setFilter = (v: SeverityFilter) => {
    onSeverityFilterChange?.(v)
    if (!onSeverityFilterChange) setLocalFilter(v)
  }

  // Group by category and apply two sort passes: severity (fail → warn → pass)
  // and, within the failing bucket, savings DESC so the highest-impact items
  // float to the top. Diagnostic / passing entries stay grouped by severity
  // then by display title for stable ordering.
  const grouped = useMemo(() => {
    const buckets: Record<AuditCategory, AuditEntry[]> = {
      performance: [],
      accessibility: [],
      "best-practices": [],
      seo: [],
    }
    for (const a of current.audits) buckets[a.category].push(a)
    const sevOrder = { fail: 0, warn: 1, pass: 2 } as const
    for (const cat of CATEGORY_ORDER) {
      buckets[cat].sort((a, b) => {
        const s = sevOrder[a.severity] - sevOrder[b.severity]
        if (s !== 0) return s
        // Inside the failing bucket: bigger savings first. ms and bytes are
        // not directly comparable but they're both "larger = bigger impact"
        // so sorting on the raw value still surfaces the heavy hitters.
        if (a.severity === "fail") {
          const sa = a.numericSavings ?? 0
          const sb = b.numericSavings ?? 0
          if (sa !== sb) return sb - sa
        }
        return a.title.localeCompare(b.title)
      })
    }
    return buckets
  }, [current])

  // Pre-compute total category counts (pre-filter) so the heading badges
  // reflect the actual failure load, not whatever the user filtered to.
  const totalCounts = useMemo(() => {
    const counts: Record<AuditCategory, { fail: number; warn: number; pass: number; total: number }> = {
      performance: { fail: 0, warn: 0, pass: 0, total: 0 },
      accessibility: { fail: 0, warn: 0, pass: 0, total: 0 },
      "best-practices": { fail: 0, warn: 0, pass: 0, total: 0 },
      seo: { fail: 0, warn: 0, pass: 0, total: 0 },
    }
    for (const cat of CATEGORY_ORDER) {
      const list = grouped[cat]
      counts[cat].total = list.length
      for (const e of list) {
        if (e.severity === "fail") counts[cat].fail++
        else if (e.severity === "warn") counts[cat].warn++
        else counts[cat].pass++
      }
    }
    return counts
  }, [grouped])

  // Build a quick lookup for prior audit entries to render delta hints.
  const priorIndex = new Map<string, AuditEntry>()
  if (prior) for (const a of prior.audits) priorIndex.set(a.id, a)

  function passes(e: AuditEntry): boolean {
    if (filter === "all") return true
    return e.severity === filter
  }

  return (
    <div className="space-y-3">
      {/* Lab CWV strip - useful at-a-glance even with the full sections below */}
      <LabCwvStrip current={current} prior={prior} />

      <SeverityChips
        value={filter}
        onChange={setFilter}
        counts={summariseCounts(totalCounts)}
      />

      {CATEGORY_ORDER.map((cat) => {
        const entries = grouped[cat]
        if (entries.length === 0) return null
        const tc = totalCounts[cat]
        const visible = entries.filter(passes)
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
                {tc.fail > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {tc.fail} failing
                  </Badge>
                )}
                {tc.warn > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {tc.warn} warn
                  </Badge>
                )}
                <span className="text-muted-foreground">
                  {filter === "all"
                    ? `${tc.total} checks`
                    : `${visible.length} / ${tc.total} checks`}
                </span>
              </span>
            </button>
            {open[cat] && (
              <ul className="border-t divide-y">
                {visible.length === 0 ? (
                  <li className="px-3 py-3 text-xs text-muted-foreground italic">
                    No entries match this filter.
                  </li>
                ) : (
                  visible.map((e) => {
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
                            <p className="font-medium flex items-center flex-wrap gap-x-2 gap-y-1">
                              <span>{e.title}</span>
                              {e.displayValue && (
                                <span className="text-xs text-muted-foreground font-normal">
                                  {e.displayValue}
                                </span>
                              )}
                              {e.severity !== "pass" && e.numericSavings != null && (
                                <SavingsPill
                                  numericSavings={e.numericSavings}
                                  unit={e.savingsUnit ?? "ms"}
                                />
                              )}
                              {changed && (
                                <span
                                  className={
                                    "text-xs font-normal " +
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
                                dangerouslySetInnerHTML={{
                                  __html: stripMarkdownLinks(e.description),
                                }}
                              />
                            )}
                          </div>
                        </div>
                      </li>
                    )
                  })
                )}
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

function summariseCounts(
  per: Record<AuditCategory, { fail: number; warn: number; pass: number; total: number }>
): { fail: number; warn: number; pass: number; total: number } {
  const acc = { fail: 0, warn: 0, pass: 0, total: 0 }
  for (const c of CATEGORY_ORDER) {
    acc.fail += per[c].fail
    acc.warn += per[c].warn
    acc.pass += per[c].pass
    acc.total += per[c].total
  }
  return acc
}

/**
 * Tab-strip selector across [All · Failing · Warnings · Passed]. Counts come
 * pre-computed from the parent so the row stays cheap to rerender on filter
 * change.
 */
function SeverityChips({
  value,
  onChange,
  counts,
}: {
  value: SeverityFilter
  onChange: (v: SeverityFilter) => void
  counts: { fail: number; warn: number; pass: number; total: number }
}) {
  const options: { key: SeverityFilter; label: string; count: number; tone: string }[] = [
    { key: "all", label: "All", count: counts.total, tone: "" },
    { key: "fail", label: "Failing", count: counts.fail, tone: "text-red-600" },
    { key: "warn", label: "Warnings", count: counts.warn, tone: "text-amber-600" },
    { key: "pass", label: "Passed", count: counts.pass, tone: "text-green-600" },
  ]
  return (
    <div className="flex flex-wrap gap-1 text-xs">
      {options.map((o) => {
        const active = o.key === value
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            aria-pressed={active}
            className={
              "inline-flex items-center gap-1.5 px-2 py-1 rounded-md border transition-colors " +
              (active
                ? "bg-foreground text-background border-foreground"
                : "bg-background hover:bg-muted")
            }
          >
            <span>{o.label}</span>
            <span
              className={
                "tabular-nums " +
                (active ? "opacity-80" : `${o.tone || "text-muted-foreground"}`)
              }
            >
              {o.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * Lighthouse-style "Potential 1.2 s saved" / "Potential 84 KiB saved" pill.
 * Picks the unit based on `savingsUnit` and formats with one decimal at the
 * scale-break (s vs ms; KiB vs bytes).
 */
function SavingsPill({
  numericSavings,
  unit,
}: {
  numericSavings: number
  unit: "ms" | "bytes"
}) {
  let display: string
  if (unit === "ms") {
    display = numericSavings >= 1000
      ? `${(numericSavings / 1000).toFixed(1)} s`
      : `${Math.round(numericSavings)} ms`
  } else {
    // Lighthouse uses KiB (1024) — match its convention so the pill matches
    // what users see in the Chrome DevTools Lighthouse panel.
    const kib = numericSavings / 1024
    display = kib >= 1
      ? `${kib >= 100 ? Math.round(kib) : kib.toFixed(1)} KiB`
      : `${Math.round(numericSavings)} B`
  }
  return (
    <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
      Potential {display} saved
    </span>
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
            <Hint text={it.tooltip} className="text-muted-foreground cursor-help w-fit">
              {it.label}
            </Hint>
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
