import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getIssuesCache, getGscCache } from "@/lib/db/queries/cache"
import { computeOpportunities } from "@/lib/seo/opportunities"
import type { GscReport } from "@/types/search-console"

export function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const domainId = Number(searchParams.get("domainId"))
  const type = searchParams.get("type") ?? "issues"
  if (isNaN(domainId)) return NextResponse.json({ error: "domainId required" }, { status: 400 })

  const db = getDb()

  if (type === "opportunities") {
    const gscData = getGscCache(db, domainId, "1m") as GscReport | null
    if (!gscData) return NextResponse.json({ error: "No GSC data — sync first" }, { status: 404 })
    return NextResponse.json(computeOpportunities(gscData.topQueries))
  }

  const data = getIssuesCache(db, domainId)
  if (!data) return NextResponse.json({ error: "No data — sync first" }, { status: 404 })
  return NextResponse.json(data)
}
