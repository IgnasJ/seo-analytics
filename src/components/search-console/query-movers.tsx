import { ArrowDown, ArrowUp, EyeOff, Sparkles, TrendingDown, TrendingUp } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Hint } from "@/components/ui/hint"
import type { LostQuery, NewQuery, QueryMover, QueryMovers } from "@/lib/seo/movers"

/**
 * "What changed in search this week" for one domain: queries that climbed or
 * slipped, queries that showed up for the first time and queries that stopped
 * appearing. Always compares the newest few days of data with the three weeks
 * before, regardless of the date range picked for the rest of the tab.
 */
export function QueryMoversCard({ movers }: { movers: QueryMovers }) {
  const { rising, falling, fresh, lost, recentDays, priorDays } = movers
  const nothing =
    rising.length === 0 && falling.length === 0 && fresh.length === 0 && lost.length === 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Query movers</CardTitle>
        <CardDescription className="text-xs">
          The last {recentDays} {recentDays === 1 ? "day" : "days"} of Search
          Console data compared with the {priorDays} days before. Fixed
          windows — not affected by the date range above.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {nothing ? (
          <p className="text-sm text-muted-foreground">
            No query moved by more than 1.5 positions with enough impressions
            to be meaningful. Rankings were stable.
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-5">
            <MoverList
              title="Climbing"
              icon={<TrendingUp className="w-3.5 h-3.5 text-green-600" />}
              hint="Queries ranking higher than in the weeks before. Ordered by estimated effect on clicks."
              rows={rising}
              empty="No query climbed noticeably."
            />
            <MoverList
              title="Slipping"
              icon={<TrendingDown className="w-3.5 h-3.5 text-red-600" />}
              hint="Queries ranking lower than in the weeks before. Ordered by estimated effect on clicks."
              rows={falling}
              empty="No query slipped noticeably."
            />
            {fresh.length > 0 && <NewList rows={fresh} />}
            {lost.length > 0 && <LostList rows={lost} />}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SectionTitle({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode
  title: string
  hint: string
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium mb-1.5">
      {icon}
      <Hint text={hint} className="cursor-help">
        <span className="underline decoration-dotted decoration-muted-foreground/40 underline-offset-2">
          {title}
        </span>
      </Hint>
    </div>
  )
}

const perDay = (n: number) => (n >= 10 ? n.toFixed(0) : n.toFixed(1))

function MoverList({
  title,
  icon,
  hint,
  rows,
  empty,
}: {
  title: string
  icon: React.ReactNode
  hint: string
  rows: QueryMover[]
  empty: string
}) {
  return (
    <div className="min-w-0">
      <SectionTitle icon={icon} title={title} hint={hint} />
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b">
              <th className="text-left font-normal pb-1">Query</th>
              <th className="text-right font-normal pb-1 whitespace-nowrap">Position</th>
              <th className="text-right font-normal pb-1 whitespace-nowrap pl-2">Impr/day</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const improved = m.positionDelta < 0
              const Arrow = improved ? ArrowUp : ArrowDown
              return (
                <tr key={m.query} className="border-b last:border-0">
                  <td className="py-1 pr-2 max-w-0 w-full">
                    <span className="block truncate" title={m.query}>
                      {m.query}
                    </span>
                  </td>
                  <td className="py-1 text-right whitespace-nowrap tabular-nums">
                    <span className="text-muted-foreground">
                      {m.priorPosition.toFixed(1)} →{" "}
                    </span>
                    <span className="font-medium">{m.recentPosition.toFixed(1)}</span>
                    <span
                      className={`inline-flex items-center ml-1.5 ${
                        improved ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      <Arrow className="w-3 h-3" />
                      {Math.abs(m.positionDelta).toFixed(1)}
                    </span>
                  </td>
                  <td className="py-1 pl-2 text-right whitespace-nowrap tabular-nums text-muted-foreground">
                    {perDay(m.recentImpressionsPerDay)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

function NewList({ rows }: { rows: NewQuery[] }) {
  return (
    <div className="min-w-0">
      <SectionTitle
        icon={<Sparkles className="w-3.5 h-3.5 text-blue-600" />}
        title="New"
        hint="Queries the site appeared for in the recent window but not in the weeks before."
      />
      <table className="w-full text-xs">
        <tbody>
          {rows.map((r) => (
            <tr key={r.query} className="border-b last:border-0">
              <td className="py-1 pr-2 max-w-0 w-full">
                <span className="block truncate" title={r.query}>
                  {r.query}
                </span>
              </td>
              <td className="py-1 text-right whitespace-nowrap tabular-nums">
                pos <span className="font-medium">{r.position.toFixed(1)}</span>
              </td>
              <td className="py-1 pl-2 text-right whitespace-nowrap tabular-nums text-muted-foreground">
                {perDay(r.impressionsPerDay)}/day
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LostList({ rows }: { rows: LostQuery[] }) {
  return (
    <div className="min-w-0">
      <SectionTitle
        icon={<EyeOff className="w-3.5 h-3.5 text-amber-600" />}
        title="No longer showing"
        hint="Queries that were shown regularly in the weeks before and got no impressions in the recent window."
      />
      <table className="w-full text-xs">
        <tbody>
          {rows.map((r) => (
            <tr key={r.query} className="border-b last:border-0">
              <td className="py-1 pr-2 max-w-0 w-full">
                <span className="block truncate" title={r.query}>
                  {r.query}
                </span>
              </td>
              <td className="py-1 text-right whitespace-nowrap tabular-nums">
                was pos <span className="font-medium">{r.priorPosition.toFixed(1)}</span>
              </td>
              <td className="py-1 pl-2 text-right whitespace-nowrap tabular-nums text-muted-foreground">
                {perDay(r.priorImpressionsPerDay)}/day
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
