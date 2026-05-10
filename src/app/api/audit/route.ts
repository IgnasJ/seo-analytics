import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import {
  createAudit,
  listAudits,
  listAuditsFiltered,
  listAuditGroupsFiltered,
  listAuditDomainGroupsFiltered,
} from "@/lib/db/queries/audits"
import { enqueue } from "@/lib/audit/queue"
import { runAudit } from "@/lib/audit/runner"
import type { AuditStatus } from "@/types/audit"

function normaliseUrl(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  // Add a default protocol if the user pasted bare hostname.
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const u = new URL(withScheme)
    return u.toString()
  } catch {
    return null
  }
}

const VALID_STATUS: AuditStatus[] = ["pending", "running", "done", "error"]

/** Map the date-window dropdown to a unix-seconds lower bound. "all" → null. */
function sinceFromWindow(w: string | null): number | null {
  if (!w || w === "all") return null
  const now = Math.floor(Date.now() / 1000)
  if (w === "7d") return now - 7 * 86400
  if (w === "30d") return now - 30 * 86400
  if (w === "90d") return now - 90 * 86400
  return null
}

export function GET(req: NextRequest) {
  const db = getDb()
  const sp = req.nextUrl.searchParams

  // Legacy flat call — no filter / page params → behave like the original
  // endpoint so anything that hasn't migrated to the page-API keeps working.
  // The current /audit page always passes `?limit=` so this branch is just a
  // belt-and-braces fallback.
  if (!sp.has("limit") && !sp.has("page") && !sp.has("view")) {
    return NextResponse.json(listAudits(db, 50))
  }

  // Three modes: flat (per-audit rows), grouped (per-URL), domain (per-host).
  const rawView = sp.get("view")
  const view: "flat" | "grouped" | "domain" =
    rawView === "grouped" ? "grouped" : rawView === "domain" ? "domain" : "flat"
  const q = sp.get("q") ?? undefined
  const statusRaw = sp.get("status") ?? undefined
  const status =
    statusRaw && (VALID_STATUS as string[]).includes(statusRaw)
      ? (statusRaw as AuditStatus)
      : undefined
  const since = sinceFromWindow(sp.get("since"))
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? "20"), 1), 100)
  const page = Math.max(Number(sp.get("page") ?? "1"), 1)
  const offset = (page - 1) * limit

  const opts = {
    search: q,
    status,
    sinceUnix: since ?? undefined,
    limit,
    offset,
  }

  if (view === "domain") {
    return NextResponse.json({ view, ...listAuditDomainGroupsFiltered(db, opts) })
  }
  if (view === "grouped") {
    return NextResponse.json({ view, ...listAuditGroupsFiltered(db, opts) })
  }
  return NextResponse.json({ view, ...listAuditsFiltered(db, opts) })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const url = typeof body.url === "string" ? normaliseUrl(body.url) : null
  if (!url) {
    return NextResponse.json({ error: "Valid url required" }, { status: 400 })
  }
  // Accept an optional strategy in the body; default to mobile. Anything other
  // than the two known values gets coerced to mobile rather than 400'd — the
  // form's segmented control should never send anything else anyway.
  const strategy = body.strategy === "desktop" ? "desktop" : "mobile"

  const db = getDb()
  const audit = createAudit(db, url, strategy)
  // Fire-and-forget: the queue serialises and the runner records its own
  // status into the audits table for the polling client to observe.
  enqueue(() => runAudit(audit.id))
  return NextResponse.json(audit, { status: 201 })
}
