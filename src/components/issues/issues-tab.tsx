"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ChevronDown,
  ChevronRight,
  Info,
  CheckCircle2,
  AlertCircle,
  XCircle,
  HelpCircle,
} from "lucide-react"
import type { IssuesReport, CwvMetric, SitemapInfo } from "@/types/search-console"
import {
  assessLcp,
  assessCls,
  assessInp,
  assessSitemap,
  NO_SITEMAPS_INSIGHT,
  type IssueInsight,
  type Severity,
} from "@/lib/seo/issue-advice"

const IMPACT_LABEL: Record<"high" | "medium" | "low", string> = {
  high: "High impact",
  medium: "Medium",
  low: "Low",
}

const IMPACT_COLOUR: Record<"high" | "medium" | "low", string> = {
  high: "bg-emerald-100 text-emerald-700 border-emerald-300",
  medium: "bg-blue-100 text-blue-700 border-blue-300",
  low: "bg-slate-100 text-slate-700 border-slate-300",
}

function SeverityIcon({ severity }: { severity: Severity }) {
  if (severity === "ok") return <CheckCircle2 className="w-4 h-4 text-green-600" />
  if (severity === "warn") return <AlertCircle className="w-4 h-4 text-amber-600" />
  if (severity === "critical") return <XCircle className="w-4 h-4 text-red-600" />
  return <HelpCircle className="w-4 h-4 text-muted-foreground" />
}

function InsightPanel({ insight }: { insight: IssueInsight }) {
  return (
    <div className="space-y-3">
      <p className="text-sm">{insight.diagnosis}</p>

      {insight.causes.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">
            Common causes
          </p>
          <ul className="list-disc pl-5 text-sm space-y-0.5">
            {insight.causes.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {insight.fixes.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">
            Fixes — highest impact first
          </p>
          <ol className="space-y-2">
            {insight.fixes.map((f, i) => (
              <li key={i} className="border rounded-md bg-background p-3">
                <div className="flex items-start gap-2 mb-1">
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded border font-medium shrink-0 ${IMPACT_COLOUR[f.impact]}`}
                  >
                    {IMPACT_LABEL[f.impact]}
                  </span>
                  <span className="text-sm font-medium">{f.title}</span>
                </div>
                <p className="text-xs text-muted-foreground pl-1">{f.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

function CwvBar({ metric }: { metric: CwvMetric | null }) {
  if (!metric) {
    return (
      <span className="text-xs text-muted-foreground">No CrUX data yet</span>
    )
  }
  return (
    <div className="flex items-center gap-3 min-w-[260px]">
      <div className="flex h-2 rounded-full overflow-hidden flex-1">
        <div className="bg-green-500" style={{ width: `${metric.good}%` }} />
        <div
          className="bg-yellow-400"
          style={{ width: `${metric.needsImprovement}%` }}
        />
        <div className="bg-red-500" style={{ width: `${metric.poor}%` }} />
      </div>
      <div className="flex gap-2 text-xs whitespace-nowrap">
        <span className="text-green-600">{metric.good}%</span>
        <span className="text-yellow-600">{metric.needsImprovement}%</span>
        <span className="text-red-600">{metric.poor}%</span>
      </div>
    </div>
  )
}

interface CwvRowProps {
  label: string
  short: string
  metric: CwvMetric | null
  insight: IssueInsight
  isOpen: boolean
  onToggle: () => void
}

function CwvRow({ label, short, metric, insight, isOpen, onToggle }: CwvRowProps) {
  return (
    <div className="border-b last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-1 py-3 text-left hover:bg-muted/30"
      >
        <span className="flex items-center gap-2 min-w-[180px]">
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          <SeverityIcon severity={insight.severity} />
          <span className="text-sm font-medium">{short}</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {label}
          </span>
        </span>
        <CwvBar metric={metric} />
      </button>
      {isOpen && (
        <div className="px-1 pb-4 pt-1">
          <InsightPanel insight={insight} />
        </div>
      )}
    </div>
  )
}

interface SitemapRowProps {
  sitemap: SitemapInfo
  isOpen: boolean
  onToggle: () => void
}

function SitemapRow({ sitemap, isOpen, onToggle }: SitemapRowProps) {
  const insight = assessSitemap(sitemap)
  const coverage = Math.round(insight.coverageRatio * 100)
  return (
    <>
      <tr
        className="border-b last:border-0 cursor-pointer hover:bg-muted/40"
        onClick={onToggle}
      >
        <td className="py-2 pl-1 w-6">
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </td>
        <td className="py-2 w-6">
          <SeverityIcon severity={insight.severity} />
        </td>
        <td className="py-2 font-mono text-xs truncate max-w-[260px]">
          {sitemap.path}
        </td>
        <td className="py-2 text-right">{sitemap.submitted}</td>
        <td className="py-2 text-right">{sitemap.indexed}</td>
        <td className="py-2 text-right">
          <span
            className={
              coverage >= 90
                ? "text-green-600"
                : coverage >= 70
                  ? "text-amber-600"
                  : "text-red-600"
            }
          >
            {coverage}%
          </span>
        </td>
        <td className="py-2 text-right">
          {sitemap.errors > 0 ? (
            <Badge variant="destructive">{sitemap.errors}</Badge>
          ) : (
            "0"
          )}
        </td>
        <td className="py-2 text-right">
          {sitemap.warnings > 0 ? (
            <Badge variant="outline" className="text-yellow-600">
              {sitemap.warnings}
            </Badge>
          ) : (
            "0"
          )}
        </td>
      </tr>
      {isOpen && (
        <tr className="bg-muted/30">
          <td colSpan={8} className="px-3 py-4">
            <InsightPanel insight={insight} />
          </td>
        </tr>
      )}
    </>
  )
}

function Explainer({
  open,
  onToggle,
}: {
  open: boolean
  onToggle: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 text-sm font-medium w-full text-left"
        >
          {open ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          <Info className="w-4 h-4 text-muted-foreground" />
          How to read this tab
        </button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            This tab surfaces the two technical health signals Google publishes
            about your site: <strong>Core Web Vitals</strong> (real-user
            performance from CrUX) and <strong>Sitemap indexing</strong>{" "}
            (whether Google is actually indexing the URLs you submitted).
          </p>
          <section className="space-y-1">
            <h3 className="font-medium text-foreground">
              Core Web Vitals — pass/fail bands
            </h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <span className="text-green-600 font-medium">OK</span> — at
                least 75% of real users hit the &ldquo;good&rdquo; threshold.
                This is the line Google uses for ranking signals.
              </li>
              <li>
                <span className="text-amber-600 font-medium">Warn</span> —
                between 50% and 75% good. Working but visibly slow for a
                meaningful portion of users.
              </li>
              <li>
                <span className="text-red-600 font-medium">Critical</span> —
                under 50% good. Affects rankings, conversions, and brand
                perception. Should be your top priority.
              </li>
              <li>
                <span className="text-muted-foreground font-medium">
                  No data
                </span>{" "}
                — CrUX needs ~28 days of opted-in Chrome traffic. Use the{" "}
                <a href="/audit" className="underline">
                  Audit tab
                </a>{" "}
                for lab metrics in the meantime.
              </li>
            </ul>
          </section>
          <section className="space-y-1">
            <h3 className="font-medium text-foreground">
              Sitemap indexing health
            </h3>
            <p>
              We compute coverage as <code>indexed / submitted</code>. Anything
              under 70% indicates Google is rejecting some of your URLs — most
              often due to noindex tags, canonicals pointing elsewhere, thin
              content, or robots.txt blocks. Click any sitemap row to see the
              specific causes and fixes for that pattern.
            </p>
          </section>
          <section className="space-y-1">
            <h3 className="font-medium text-foreground">Fix priority</h3>
            <p>
              Within each issue we order fixes by expected impact (
              <span className="text-emerald-700 font-medium">High</span> →{" "}
              <span className="text-blue-700 font-medium">Medium</span> →{" "}
              <span className="text-slate-700 font-medium">Low</span>). Start
              from the top — high-impact fixes typically deliver 30%+ of the
              improvement.
            </p>
          </section>
        </CardContent>
      )}
    </Card>
  )
}

export function IssuesTab({ data }: { data: IssuesReport | null }) {
  const [explainerOpen, setExplainerOpen] = useState(false)
  const [openCwv, setOpenCwv] = useState<"lcp" | "cls" | "inp" | null>(null)
  const [openSitemap, setOpenSitemap] = useState<number | null>(null)

  if (!data) {
    return (
      <p className="text-muted-foreground text-sm">
        No issues data. Sync to load.
      </p>
    )
  }

  const lcpInsight = assessLcp(data.cwv.lcp)
  const clsInsight = assessCls(data.cwv.cls)
  const inpInsight = assessInp(data.cwv.inp)

  return (
    <div className="space-y-4">
      <Explainer
        open={explainerOpen}
        onToggle={() => setExplainerOpen((o) => !o)}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Core Web Vitals</CardTitle>
          <p className="text-xs text-muted-foreground">
            Click any metric for diagnosis, common causes, and ranked fixes.
          </p>
        </CardHeader>
        <CardContent className="divide-y">
          <CwvRow
            label="Largest Contentful Paint"
            short="LCP"
            metric={data.cwv.lcp}
            insight={lcpInsight}
            isOpen={openCwv === "lcp"}
            onToggle={() => setOpenCwv((o) => (o === "lcp" ? null : "lcp"))}
          />
          <CwvRow
            label="Cumulative Layout Shift"
            short="CLS"
            metric={data.cwv.cls}
            insight={clsInsight}
            isOpen={openCwv === "cls"}
            onToggle={() => setOpenCwv((o) => (o === "cls" ? null : "cls"))}
          />
          <CwvRow
            label="Interaction to Next Paint"
            short="INP"
            metric={data.cwv.inp}
            insight={inpInsight}
            isOpen={openCwv === "inp"}
            onToggle={() => setOpenCwv((o) => (o === "inp" ? null : "inp"))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sitemaps</CardTitle>
          <p className="text-xs text-muted-foreground">
            Click a row for indexing diagnosis and remediation steps.
          </p>
        </CardHeader>
        <CardContent>
          {data.sitemaps.length === 0 ? (
            <InsightPanel insight={NO_SITEMAPS_INSIGHT} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left pb-2 font-medium pl-1 w-6"></th>
                    <th className="text-left pb-2 font-medium w-6"></th>
                    <th className="text-left pb-2 font-medium">Sitemap</th>
                    <th className="text-right pb-2 font-medium">Submitted</th>
                    <th className="text-right pb-2 font-medium">Indexed</th>
                    <th className="text-right pb-2 font-medium">Coverage</th>
                    <th className="text-right pb-2 font-medium">Errors</th>
                    <th className="text-right pb-2 font-medium">Warnings</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sitemaps.map((sm, i) => (
                    <SitemapRow
                      key={i}
                      sitemap={sm}
                      isOpen={openSitemap === i}
                      onToggle={() =>
                        setOpenSitemap((o) => (o === i ? null : i))
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
