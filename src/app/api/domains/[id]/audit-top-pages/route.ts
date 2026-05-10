import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getDomain } from "@/lib/db/queries/domains"
import { getGscCache } from "@/lib/db/queries/cache"
import { createAudit } from "@/lib/db/queries/audits"
import { enqueue } from "@/lib/audit/queue"
import { runAudit } from "@/lib/audit/runner"
import { DEFAULT_RANGE } from "@/lib/date-range"
import type { GscReport } from "@/types/search-console"

const DEFAULT_N = 10
const MAX_N = 25

/**
 * Batch-audit the top-N GSC pages for a domain. Reads `gsc.topPages` from the
 * default range cache, takes top-N by clicks, queues one audit per URL with
 * the requested strategy. Skips URLs we've already queued in this call to
 * avoid double-counting if a URL appears twice in the GSC payload.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const domainId = Number(id)
  if (isNaN(domainId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const n = Math.min(Math.max(Number(body.n ?? DEFAULT_N), 1), MAX_N)
  const strategy = body.strategy === "desktop" ? "desktop" : "mobile"

  const db = getDb()
  const domain = getDomain(db, domainId)
  if (!domain) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 })
  }

  const gsc = getGscCache(db, domainId, DEFAULT_RANGE) as GscReport | null
  const topPages = gsc?.topPages ?? []
  if (topPages.length === 0) {
    return NextResponse.json(
      {
        error:
          "No GSC top-pages data cached yet. Run a Sync first so we know which pages to audit.",
      },
      { status: 400 }
    )
  }

  // Sort by clicks DESC (defensive — should already be ordered) and slice.
  const ranked = [...topPages].sort((a, b) => b.clicks - a.clicks).slice(0, n)

  const ids: number[] = []
  const seen = new Set<string>()
  for (const p of ranked) {
    if (!p.page || seen.has(p.page)) continue
    seen.add(p.page)
    const audit = createAudit(db, p.page, strategy)
    enqueue(() => runAudit(audit.id))
    ids.push(audit.id)
  }

  return NextResponse.json(
    { ids, queued: ids.length, hostname: domain.hostname },
    { status: 201 }
  )
}
