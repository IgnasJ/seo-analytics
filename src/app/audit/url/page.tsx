import { notFound, redirect } from "next/navigation"
import { getDb } from "@/lib/db"
import { listAuditsForUrl } from "@/lib/db/queries/audits"
import { listDomains } from "@/lib/db/queries/domains"
import { PageBreadcrumbs } from "@/components/page-breadcrumbs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StrategyTabs } from "@/components/audit/strategy-tabs"
import { UrlAuditHeader } from "@/components/audit/url-header"
import { UrlScoreChart } from "@/components/audit/url-score-chart"
import { UrlCwvChart } from "@/components/audit/url-cwv-chart"
import { AuditPairCompare } from "@/components/audit/audit-pair-selector"
import { ScreenshotStrip } from "@/components/audit/screenshot-strip"
import type { Audit, AuditStrategy, AuditResult } from "@/types/audit"

export const dynamic = "force-dynamic"

/**
 * `/audit/url?u=<encoded-url>` — single-URL audit history with trend charts,
 * pair comparison, and a screenshot strip. Server-rendered shell; charts and
 * pair selector are client islands.
 */
export default async function AuditUrlPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const raw = Array.isArray(sp.u) ? sp.u[0] : sp.u
  if (!raw) {
    // Without a URL we can't render anything useful — bounce back to /audit
    // rather than rendering a blank shell.
    redirect("/audit")
  }
  const targetUrl = raw.trim()
  if (!targetUrl) notFound()

  const db = getDb()
  const audits = listAuditsForUrl(db, targetUrl)
  if (audits.length === 0) notFound()

  // Find which tracked domain (if any) hosts this URL. Compare hostnames so
  // /blog/x on tracked-domain.com resolves to that domain.
  const domains = listDomains(db)
  let host = ""
  try {
    host = new URL(targetUrl).hostname
  } catch {
    host = ""
  }
  const matchedDomain = domains.find((d) => d.hostname === host) ?? null

  // Split per strategy so each tab can render an independent chart series
  // and pair selector. Newest-first ordering is already provided by the query.
  const mobile = audits.filter((a) => (a.strategy ?? "mobile") === "mobile")
  const desktop = audits.filter((a) => a.strategy === "desktop")

  // Pick the default tab from whichever strategy ran most recently so users
  // who only ever use mobile don't have to click through.
  const newestStrategy: AuditStrategy = audits[0].strategy ?? "mobile"
  const defaultTab: AuditStrategy =
    newestStrategy === "desktop" && desktop.length > 0
      ? "desktop"
      : mobile.length > 0
        ? "mobile"
        : "desktop"

  // Severity filter on the diff comes through the URL so the user can deep-
  // link to e.g. ?u=…&sev=fail and land on "show failing entries only".
  const sev = (Array.isArray(sp.sev) ? sp.sev[0] : sp.sev) ?? "all"
  // Compare-pair selection — `a` / `b` are audit ids. When absent the client
  // defaults to the newest two within the active tab.
  const compareA = numOrNull(Array.isArray(sp.a) ? sp.a[0] : sp.a)
  const compareB = numOrNull(Array.isArray(sp.b) ? sp.b[0] : sp.b)

  return (
    <div className="space-y-4">
      <PageBreadcrumbs
        items={[
          { label: "Dashboard", href: "/" },
          { label: "Audit", href: "/audit" },
          { label: prettyLabel(targetUrl) },
        ]}
      />

      <UrlAuditHeader
        url={targetUrl}
        domain={matchedDomain}
        strategyDefault={defaultTab}
      />

      <StrategyTabs
        initialStrategy={defaultTab}
        mobileCount={mobile.length}
        desktopCount={desktop.length}
        mobileContent={
          mobile.length > 0 ? (
            <StrategyView
              audits={mobile}
              sev={sev}
              compareA={compareA}
              compareB={compareB}
            />
          ) : null
        }
        desktopContent={
          desktop.length > 0 ? (
            <StrategyView
              audits={desktop}
              sev={sev}
              compareA={compareA}
              compareB={compareB}
            />
          ) : null
        }
      />
    </div>
  )
}

function StrategyView({
  audits,
  sev,
  compareA,
  compareB,
}: {
  audits: Audit[]
  sev: string
  compareA: number | null
  compareB: number | null
}) {
  // Parse result_json once and pair each parse with its source audit so the
  // chart and screenshot strip both work off the same indexed dataset.
  const points = audits
    .filter((a) => a.status === "done" && a.result_json)
    .map((a) => {
      try {
        const result = JSON.parse(a.result_json!) as AuditResult
        return { audit: a, result }
      } catch {
        return null
      }
    })
    .filter((x): x is { audit: Audit; result: AuditResult } => x !== null)

  return (
    <div className="space-y-4 pt-2">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Scores over time</CardTitle>
          </CardHeader>
          <CardContent>
            {points.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No completed audits yet for this strategy.
              </p>
            ) : (
              <UrlScoreChart points={points} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Lab Core Web Vitals over time</CardTitle>
          </CardHeader>
          <CardContent>
            {points.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No completed audits yet for this strategy.
              </p>
            ) : (
              <UrlCwvChart points={points} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Audits</CardTitle>
        </CardHeader>
        <CardContent>
          <AuditPairCompare
            audits={audits}
            initialSeverity={
              sev === "fail" || sev === "warn" || sev === "pass" ? sev : "all"
            }
            initialA={compareA}
            initialB={compareB}
          />
        </CardContent>
      </Card>

      {points.some((p) => p.result.screenshot) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Screenshots over time</CardTitle>
          </CardHeader>
          <CardContent>
            <ScreenshotStrip points={points} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function prettyLabel(url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname + u.search
    return path === "/" ? u.hostname : `${u.hostname}${path}`
  } catch {
    return url
  }
}

function numOrNull(v: string | undefined): number | null {
  if (!v) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
