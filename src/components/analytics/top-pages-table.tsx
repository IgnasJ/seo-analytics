"use client"

import { useEffect, useState } from "react"
import type { PageRow } from "@/types/analytics"
import { PageNav } from "@/components/ui/page-nav"

const PAGE_SIZE = 10

export function TopPagesTable({ data }: { data: PageRow[] }) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE))

  // Reset to page 1 whenever the underlying dataset changes (e.g. user picks
  // a different date range and the parent re-renders with a new array).
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
              <th className="text-left pb-2 font-medium">Page</th>
              <th className="text-right pb-2 font-medium">Sessions</th>
              <th className="text-right pb-2 font-medium">Pageviews</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((row, i) => (
              <tr key={start + i} className="border-b last:border-0">
                <td className="py-2 font-mono text-xs truncate max-w-[240px]">
                  {row.pagePath}
                </td>
                <td className="py-2 text-right">
                  {row.sessions.toLocaleString()}
                </td>
                <td className="py-2 text-right">
                  {row.pageviews.toLocaleString()}
                </td>
              </tr>
            ))}
            {slice.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="py-4 text-center text-muted-foreground text-xs"
                >
                  No pages in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data.length > PAGE_SIZE && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-muted-foreground">
          <span className="whitespace-nowrap">
            Showing{" "}
            <strong>
              {start + 1}–{end}
            </strong>{" "}
            of <strong>{data.length}</strong>
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
