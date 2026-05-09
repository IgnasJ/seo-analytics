import type { PageRow } from "@/types/analytics"

export function TopPagesTable({ data }: { data: PageRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="text-left pb-2 font-medium">Page</th>
            <th className="text-right pb-2 font-medium">Sessions</th>
            <th className="text-right pb-2 font-medium">Pageviews</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 10).map((row, i) => (
            <tr key={i} className="border-b last:border-0">
              <td className="py-2 font-mono text-xs truncate max-w-[240px]">{row.pagePath}</td>
              <td className="py-2 text-right">{row.sessions.toLocaleString()}</td>
              <td className="py-2 text-right">{row.pageviews.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
