import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { createAudit, listAudits } from "@/lib/db/queries/audits"
import { enqueue } from "@/lib/audit/queue"
import { runAudit } from "@/lib/audit/runner"

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

export function GET() {
  const db = getDb()
  return NextResponse.json(listAudits(db, 50))
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const url = typeof body.url === "string" ? normaliseUrl(body.url) : null
  if (!url) {
    return NextResponse.json({ error: "Valid url required" }, { status: 400 })
  }

  const db = getDb()
  const audit = createAudit(db, url)
  // Fire-and-forget: the queue serialises and the runner records its own
  // status into the audits table for the polling client to observe.
  enqueue(() => runAudit(audit.id))
  return NextResponse.json(audit, { status: 201 })
}
