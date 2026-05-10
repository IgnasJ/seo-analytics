"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
} from "lucide-react"

interface SyncLogEntry {
  id: number
  domain_id: number | null
  hostname: string | null
  status: "success" | "error"
  synced_at: number
}

interface SyncLogPage {
  entries: SyncLogEntry[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const PAGE_SIZE = 20

export function SyncHistory() {
  const [data, setData] = useState<SyncLogPage | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Stash a stable ref so concurrent page changes don't race.
  const requestId = useRef(0)

  async function load(targetPage: number) {
    setLoading(true)
    setError(null)
    const myId = ++requestId.current
    try {
      const res = await fetch(
        `/api/sync-log?page=${targetPage}&pageSize=${PAGE_SIZE}`
      )
      if (myId !== requestId.current) return // a newer request superseded this one
      if (!res.ok) {
        setError(`Request failed (${res.status})`)
        return
      }
      const body = (await res.json()) as SyncLogPage
      setData(body)
    } catch (err) {
      if (myId !== requestId.current) return
      setError(err instanceof Error ? err.message : "Network error")
    } finally {
      if (myId === requestId.current) setLoading(false)
    }
  }

  useEffect(() => {
    load(page)
  }, [page])

  const totalPages = data?.totalPages ?? 1
  const total = data?.total ?? 0
  const start = data ? (data.page - 1) * data.pageSize + 1 : 0
  const end = data ? Math.min(data.page * data.pageSize, data.total) : 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm">Sync history</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Each row is one full sync run for a domain (all date ranges
              fetched in one pass).
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => load(page)}
            disabled={loading}
            aria-label="Refresh sync history"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && <p className="text-xs text-destructive mb-2">{error}</p>}
        {data && data.entries.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No sync activity yet. Open a domain and click Sync.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left pb-2 font-medium">Domain</th>
                  <th className="text-left pb-2 font-medium">Time</th>
                  <th className="text-right pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data?.entries.map((e) => (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="py-2 font-medium">
                      {e.hostname ?? (
                        <span className="text-muted-foreground italic">
                          (deleted)
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {formatTimestamp(e.synced_at)}
                    </td>
                    <td className="py-2 text-right">
                      <StatusBadge status={e.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.total > 0 && (
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Showing <strong>{start}</strong>–<strong>{end}</strong> of{" "}
              <strong>{total}</strong>
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage(1)}
                disabled={page <= 1 || loading}
                aria-label="First page"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                aria-label="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="px-2">
                Page {data.page} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                aria-label="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages || loading}
                aria-label="Last page"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: "success" | "error" }) {
  if (status === "success") {
    return (
      <Badge className="bg-green-100 text-green-700 border-green-300 hover:bg-green-100">
        success
      </Badge>
    )
  }
  return <Badge variant="destructive">error</Badge>
}

function formatTimestamp(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000)
  const ageMin = Math.round((Date.now() - d.getTime()) / 60_000)
  const abs = d.toLocaleString()
  if (ageMin < 60) return `${abs} (${ageMin} min ago)`
  if (ageMin < 60 * 24) return `${abs} (${Math.round(ageMin / 60)} h ago)`
  return abs
}
