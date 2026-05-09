import type { QueryRow } from "@/types/search-console"

export function TopQueriesTable({ data }: { data: QueryRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="text-left pb-2 font-medium">Query</th>
            <th className="text-right pb-2 font-medium">Clicks</th>
            <th className="text-right pb-2 font-medium">Impr.</th>
            <th className="text-right pb-2 font-medium">CTR</th>
            <th className="text-right pb-2 font-medium">Pos.</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 15).map((row, i) => (
            <tr key={i} className="border-b last:border-0">
              <td className="py-2 truncate max-w-[200px]">{row.query}</td>
              <td className="py-2 text-right">{row.clicks}</td>
              <td className="py-2 text-right">{row.impressions.toLocaleString()}</td>
              <td className="py-2 text-right">{(row.ctr * 100).toFixed(1)}%</td>
              <td className="py-2 text-right">{row.position.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
