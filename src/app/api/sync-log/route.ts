import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { listSyncLog } from "@/lib/db/queries/sync-log"

export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const page = Number(sp.get("page") ?? "1")
  const pageSize = Number(sp.get("pageSize") ?? "20")

  const db = getDb()
  const result = listSyncLog(db, {
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 20,
  })
  return NextResponse.json(result)
}
