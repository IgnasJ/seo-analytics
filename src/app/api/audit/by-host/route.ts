import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { listAuditsForHostname } from "@/lib/db/queries/audits"

/**
 * Paginated audits for a single hostname. Backs the Audits tab on
 * `/domain/[id]` — that page passes the domain's hostname rather than its id
 * so the same query is usable from anywhere we know a hostname.
 */
export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const hostname = sp.get("hostname")
  if (!hostname) {
    return NextResponse.json({ error: "hostname required" }, { status: 400 })
  }
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? "20"), 1), 100)
  const page = Math.max(Number(sp.get("page") ?? "1"), 1)
  const offset = (page - 1) * limit

  const db = getDb()
  const result = listAuditsForHostname(db, hostname, limit, offset)
  return NextResponse.json(result)
}
