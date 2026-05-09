import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { createAudit } from "@/lib/db/queries/audits"
import { enqueue } from "@/lib/audit/queue"
import { runAudit } from "@/lib/audit/runner"

const MAX_BATCH = 50

function normaliseUrl(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    return new URL(withScheme).toString()
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (!Array.isArray(body.urls)) {
    return NextResponse.json({ error: "urls array required" }, { status: 400 })
  }
  if (body.urls.length === 0) {
    return NextResponse.json({ error: "At least one URL required" }, { status: 400 })
  }
  if (body.urls.length > MAX_BATCH) {
    return NextResponse.json(
      { error: `Maximum ${MAX_BATCH} URLs per batch` },
      { status: 400 }
    )
  }

  const db = getDb()
  const ids: number[] = []
  const skipped: string[] = []

  for (const raw of body.urls) {
    if (typeof raw !== "string") {
      skipped.push(String(raw))
      continue
    }
    const url = normaliseUrl(raw)
    if (!url) {
      skipped.push(raw)
      continue
    }
    const audit = createAudit(db, url)
    enqueue(() => runAudit(audit.id))
    ids.push(audit.id)
  }

  return NextResponse.json({ ids, skipped }, { status: 201 })
}
