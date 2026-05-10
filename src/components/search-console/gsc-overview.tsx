import { Card, CardContent } from "@/components/ui/card"
import type { GscOverview } from "@/types/search-console"
import { formatInteger } from "@/lib/format"

export function GscOverview({ data }: { data: GscOverview }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[
        { label: "Total Clicks", value: formatInteger(data.totalClicks) },
        { label: "Impressions", value: formatInteger(data.totalImpressions) },
        { label: "Avg CTR", value: `${(data.avgCtr * 100).toFixed(2)}%` },
        { label: "Avg Position", value: data.avgPosition.toFixed(1) },
      ].map((m) => (
        <Card key={m.label}>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">{m.label}</p>
            <p className="text-2xl font-semibold mt-1">{m.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
