import { Card, CardContent } from "@/components/ui/card"
import type { AnalyticsOverview } from "@/types/analytics"

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold mt-1">{value}</p>
      </CardContent>
    </Card>
  )
}

export function MetricsOverview({ data }: { data: AnalyticsOverview }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <MetricCard label="Sessions" value={data.sessions.toLocaleString()} />
      <MetricCard label="Users" value={data.users.toLocaleString()} />
      <MetricCard label="Pageviews" value={data.pageviews.toLocaleString()} />
      <MetricCard label="Bounce Rate" value={`${(data.bounceRate * 100).toFixed(1)}%`} />
      <MetricCard label="Avg Duration" value={`${Math.round(data.avgSessionDuration)}s`} />
    </div>
  )
}
