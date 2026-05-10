"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronRight, TrendingUp, Lightbulb, Info } from "lucide-react"
import type { OpportunityRow } from "@/lib/seo/opportunities"
import { recommendationFor } from "@/lib/seo/recommendations"
import { Hint } from "@/components/ui/hint"
import { formatInteger } from "@/lib/format"

export function OpportunitiesTab({ data }: { data: OpportunityRow[] }) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const [explainerOpen, setExplainerOpen] = useState(false)

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground text-sm">
          No opportunities found yet. Either you don&apos;t have enough Search
          Console data, every ranking keyword is already optimized, or all
          keywords sit outside the page 4–20 sweet-spot.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Explainer open={explainerOpen} onToggle={() => setExplainerOpen((o) => !o)} />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Quick-win keywords</CardTitle>
          <p className="text-xs text-muted-foreground">
            Click a row for a tailored diagnosis, action checklist, and traffic
            uplift estimate.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left pb-2 font-medium pl-1 w-6"></th>
                  <th className="text-left pb-2 font-medium">
                    <Hint
                      text="The exact search query users typed. Pulled from Search Console for the last 30 days."
                      className="cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2"
                    >
                      Keyword
                    </Hint>
                  </th>
                  <th className="text-right pb-2 font-medium">
                    <Hint
                      text="Average rank in Google search results. Lower is better — 4–10 is page 1, 11–20 is page 2."
                      className="cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2"
                    >
                      Pos.
                    </Hint>
                  </th>
                  <th className="text-right pb-2 font-medium">
                    <Hint
                      text="Number of times the page appeared in search results for this query in the last 30 days. Real search demand."
                      className="cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2"
                    >
                      Impr.
                    </Hint>
                  </th>
                  <th className="text-right pb-2 font-medium">
                    <Hint
                      text="Click-through rate — clicks ÷ impressions. Quick-wins surface where CTR is below the average for this candidate set, indicating snippet underperforms vs peers."
                      className="cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2"
                    >
                      CTR
                    </Hint>
                  </th>
                  <th className="text-right pb-2 font-medium">
                    <Hint
                      text={
                        <div className="space-y-1.5">
                          <div>
                            <strong>Opportunity Score</strong> ranks keywords by
                            their potential to convert into traffic.
                          </div>
                          <div>
                            <span className="font-mono text-[10px]">
                              score = (impressions ÷ (position × CTR)) × 10
                            </span>
                          </div>
                          <div>
                            Higher = better opportunity. The formula favours
                            queries with <strong>lots of impressions</strong>{" "}
                            (real demand), already{" "}
                            <strong>close to the top</strong> (low position
                            number), and currently{" "}
                            <strong>low CTR</strong> (room to grow once you
                            move up).
                          </div>
                          <div>
                            It&apos;s a relative ranking, not an absolute
                            number — compare scores across rows in this table,
                            not to other domains.
                          </div>
                        </div>
                      }
                      className="cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2"
                    >
                      Score
                    </Hint>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <Row
                    key={i}
                    row={row}
                    isExpanded={expanded === i}
                    onToggle={() =>
                      setExpanded((curr) => (curr === i ? null : i))
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
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
          How quick-win keywords are picked &amp; what to do with them
        </button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            A &ldquo;quick-win keyword&rdquo; is a search query where the page
            already shows up in Google but isn&apos;t getting the traffic it
            could. We surface them so you can spend your SEO time on the
            highest-ROI work — improving pages Google already trusts — rather
            than starting new content from scratch.
          </p>

          <section className="space-y-1">
            <h3 className="font-medium text-foreground">
              The picking rules
            </h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Position 4–20.</strong> Rank #1–3 keywords are already
                winning. Beyond #20, fixing on-page issues won&apos;t move the
                needle — you need backlinks or new content.
              </li>
              <li>
                <strong>Above-median impressions.</strong> Filters out
                long-tail noise. We only flag queries with real search demand.
              </li>
              <li>
                <strong>Below-average CTR.</strong> Among the candidates, your
                snippet underperforms its peers. That&apos;s your leverage.
              </li>
            </ul>
            <p className="pt-1">
              The <code>Score</code> column is a relative ranking — higher
              means more impressions per position-step, so easier to convert.
            </p>
          </section>

          <section className="space-y-1">
            <h3 className="font-medium text-foreground">
              Page 1 (#4–10): on-page tweaks
            </h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Refresh and expand content — add 200–500 words of related
                sub-topics, FAQs, comparisons.
              </li>
              <li>
                Make sure the exact target query (or close variant) appears in
                the H1 and meta title.
              </li>
              <li>
                Add 3–5 internal links from your highest-traffic pages to this
                URL with the target query as anchor text.
              </li>
              <li>
                If CTR is below ~2%, rewrite the meta title and description for
                click appeal.
              </li>
              <li>
                Check for keyword cannibalization — multiple of your pages
                competing for the same query split your authority.
              </li>
            </ul>
          </section>

          <section className="space-y-1">
            <h3 className="font-medium text-foreground">
              Page 2 (#11–20): break onto page 1
            </h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Build supporting cluster content — 2–3 related articles linking
                back to this URL.
              </li>
              <li>
                Acquire 1–3 quality backlinks to the exact URL (guest post,
                digital PR, unlinked-mention outreach).
              </li>
              <li>
                Audit on-page basics: target query in H1 + title, descriptive
                image alt text, fast LCP, no thin sections.
              </li>
              <li>
                Update the publish/modified date and modernize the content —
                Google rewards freshness for many query types.
              </li>
              <li>
                Compare your page to the top 3 ranking results — what sections
                do they have that you don&apos;t?
              </li>
            </ul>
          </section>

          <section className="space-y-1">
            <h3 className="font-medium text-foreground">
              How the &ldquo;potential clicks&rdquo; estimate is computed
            </h3>
            <p>
              We multiply your current monthly impression count by the
              difference between the average CTR at position 3 (~12%) and the
              average CTR at your current position. So a query at #15 with
              5,000 impressions and 0.5% CTR could plausibly add ~530 clicks if
              you reached the top 3. Industry CTR curves are approximate;
              treat the number as order-of-magnitude, not a forecast.
            </p>
          </section>
        </CardContent>
      )}
    </Card>
  )
}

function Row({
  row,
  isExpanded,
  onToggle,
}: {
  row: OpportunityRow
  isExpanded: boolean
  onToggle: () => void
}) {
  const rec = recommendationFor(row)
  const onPageOne = row.position <= 10

  return (
    <>
      <tr
        className="border-b last:border-0 cursor-pointer hover:bg-muted/40"
        onClick={onToggle}
      >
        <td className="py-2 pl-1">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </td>
        <td className="py-2">{row.query}</td>
        <td className="py-2 text-right">
          <span className="inline-flex items-center gap-1">
            <Badge
              variant={onPageOne ? "default" : "outline"}
              className="text-xs"
            >
              {onPageOne ? "P1" : "P2"}
            </Badge>
            {row.position.toFixed(1)}
          </span>
        </td>
        <td className="py-2 text-right">{formatInteger(row.impressions)}</td>
        <td className="py-2 text-right">{(row.ctr * 100).toFixed(1)}%</td>
        <td className="py-2 text-right font-medium">{row.opportunityScore}</td>
      </tr>
      {isExpanded && (
        <tr className="bg-muted/30">
          <td colSpan={6} className="px-3 py-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-3">
                <div className="flex items-start gap-2 text-sm">
                  <Lightbulb className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
                  <p>{rec.diagnosis}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                    What to do, in order
                  </p>
                  <ol className="list-decimal pl-5 text-sm space-y-1.5">
                    {rec.actions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ol>
                </div>
              </div>
              <div className="space-y-3">
                <div className="bg-background border rounded-md p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    Potential clicks if top-3
                  </p>
                  <p className="text-2xl font-semibold">
                    {rec.potentialClicks > 0
                      ? `+${formatInteger(rec.potentialClicks)}`
                      : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Estimated additional clicks per month at current impression
                    volume.
                  </p>
                </div>
                <div className="bg-background border rounded-md p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current CTR</span>
                    <span className="font-medium">
                      {(row.ctr * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Target CTR (#3)</span>
                    <span className="font-medium">~12%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current clicks</span>
                    <span className="font-medium">{row.clicks}</span>
                  </div>
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(
                      row.query
                    )}`}
                    target="_blank"
                    rel="noopener"
                    className="block pt-1 text-primary underline"
                  >
                    See current SERP →
                  </a>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
