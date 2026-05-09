import type { PositionBuckets } from "@/types/search-console"

export function PositionBucketsChart({ data }: { data: PositionBuckets }) {
  const buckets = [
    { label: "Top 3", count: data.top3, color: "bg-green-500" },
    { label: "4–10", count: data.page1, color: "bg-blue-500" },
    { label: "11–20", count: data.page2, color: "bg-yellow-500" },
    { label: "21+", count: data.beyond, color: "bg-gray-400" },
  ]
  const total = buckets.reduce((s, b) => s + b.count, 0)
  return (
    <div className="space-y-2">
      {buckets.map((b) => (
        <div key={b.label} className="flex items-center gap-3">
          <span className="text-xs w-12 text-muted-foreground">{b.label}</span>
          <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
            <div
              className={`h-full ${b.color} rounded-full`}
              style={{ width: total > 0 ? `${(b.count / total) * 100}%` : "0%" }}
            />
          </div>
          <span className="text-xs w-8 text-right font-medium">{b.count}</span>
        </div>
      ))}
    </div>
  )
}
