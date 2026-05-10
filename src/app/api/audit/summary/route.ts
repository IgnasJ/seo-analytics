import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { listAuditsFiltered } from "@/lib/db/queries/audits"
import { summariseAudits } from "@/lib/audit/aggregates"

const HARD_LIMIT = 500

/**
 * Cross-URL summary for `/audit`'s collapsible summary card. Window defaults
 * to 30 days but accepts `?days=7|30|90`. Caps the per-window scan at
 * HARD_LIMIT rows — anything beyond that and the rolling average is more
 * statistical noise than insight; pagination on history covers the deep dive.
 */
export function GET(req: NextRequest) {
  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get("days") ?? "30"), 1), 365)
  const sinceUnix = Math.floor(Date.now() / 1000) - days * 86400

  const db = getDb()
  // Only "done" rows have scores to roll up; the aggregator drops the rest
  // defensively anyway but filtering at the SQL layer means we don't ship
  // hundreds of useless error rows through JSON.parse.
  const { rows } = listAuditsFiltered(db, {
    status: "done",
    sinceUnix,
    limit: HARD_LIMIT,
    offset: 0,
  })
  return NextResponse.json({ days, ...summariseAudits(rows, { topN: 5 }) })
}
