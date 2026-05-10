"use client"

import { useEffect, useState } from "react"
import type { QueryRow } from "@/types/search-console"
import { PageNav } from "@/components/ui/page-nav"

const PAGE_SIZE = 15

export function TopQueriesTable({ data }: { data: QueryRow[] }) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE))

  useEffect(() => {
    setPage(1)
  }, [data])

  const start = (page - 1) * PAGE_SIZE
  const slice = data.slice(start, start + PAGE_SIZE)
  const end = Math.min(start + PAGE_SIZE, data.length)

  return (
    <div className="space-y-3">
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
            {slice.map((row, i) => (
              <tr key={start + i} className="border-b last:border-0">
                <td className="py-2 truncate max-w-[200px]">{row.query}</td>
                <td className="py-2 text-right">{row.clicks}</td>
                <td className="py-2 text-right">
                  {row.impressions.toLocaleString()}
                </td>
                <td className="py-2 text-right">
                  {(row.ctr * 100).toFixed(1)}%
                </td>
                <td className="py-2 text-right">{row.position.toFixed(1)}</td>
              </tr>
            ))}
            {slice.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="py-4 text-center text-muted-foreground text-xs"
                >
                  No queries in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data.length > PAGE_SIZE && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Showing <strong>{start + 1}</strong>–<strong>{end}</strong> of{" "}
            <strong>{data.length}</strong>
          </span>
          <PageNav
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  )
}
