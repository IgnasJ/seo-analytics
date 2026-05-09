import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { IssuesReport, CwvMetric } from "@/types/search-console"

function CwvBar({ label, metric }: { label: string; metric: CwvMetric | null }) {
  if (!metric) return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm">{label}</span>
      <span className="text-xs text-muted-foreground">No data</span>
    </div>
  )
  return (
    <div className="py-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">{label}</span>
        <div className="flex gap-2 text-xs">
          <span className="text-green-600">{metric.good}% good</span>
          <span className="text-yellow-600">{metric.needsImprovement}% needs work</span>
          <span className="text-red-600">{metric.poor}% poor</span>
        </div>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden">
        <div className="bg-green-500" style={{ width: `${metric.good}%` }} />
        <div className="bg-yellow-400" style={{ width: `${metric.needsImprovement}%` }} />
        <div className="bg-red-500" style={{ width: `${metric.poor}%` }} />
      </div>
    </div>
  )
}

export function IssuesTab({ data }: { data: IssuesReport | null }) {
  if (!data) return <p className="text-muted-foreground text-sm">No issues data. Sync to load.</p>

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Core Web Vitals</CardTitle></CardHeader>
        <CardContent className="divide-y">
          <CwvBar label="LCP (Largest Contentful Paint)" metric={data.cwv.lcp} />
          <CwvBar label="CLS (Cumulative Layout Shift)" metric={data.cwv.cls} />
          <CwvBar label="INP (Interaction to Next Paint)" metric={data.cwv.inp} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Sitemaps</CardTitle></CardHeader>
        <CardContent>
          {data.sitemaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sitemaps found in Search Console.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left pb-2 font-medium">Sitemap</th>
                  <th className="text-right pb-2 font-medium">Submitted</th>
                  <th className="text-right pb-2 font-medium">Indexed</th>
                  <th className="text-right pb-2 font-medium">Errors</th>
                  <th className="text-right pb-2 font-medium">Warnings</th>
                </tr>
              </thead>
              <tbody>
                {data.sitemaps.map((sm, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 font-mono text-xs truncate max-w-[200px]">{sm.path}</td>
                    <td className="py-2 text-right">{sm.submitted}</td>
                    <td className="py-2 text-right">{sm.indexed}</td>
                    <td className="py-2 text-right">
                      {sm.errors > 0 ? <Badge variant="destructive">{sm.errors}</Badge> : "0"}
                    </td>
                    <td className="py-2 text-right">
                      {sm.warnings > 0 ? <Badge variant="outline" className="text-yellow-600">{sm.warnings}</Badge> : "0"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
