import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getGscCache } from "@/lib/db/queries/cache"

export function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const domainId = Number(searchParams.get("domainId"))
  const dateRange = searchParams.get("dateRange") ?? "1m"
  if (isNaN(domainId)) return NextResponse.json({ error: "domainId required" }, { status: 400 })

  const db = getDb()
  const data = getGscCache(db, domainId, dateRange)
  if (!data) return NextResponse.json({ error: "No data — sync first" }, { status: 404 })
  return NextResponse.json(data)
}
