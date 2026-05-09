import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import {
  getAudit,
  getPriorCompletedAudit,
  deleteAudit,
} from "@/lib/db/queries/audits"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auditId = Number(id)
  if (isNaN(auditId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const db = getDb()
  const audit = getAudit(db, auditId)
  if (!audit) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Attach the previous completed audit for this URL so the client can
  // render inline diff badges without a second round-trip.
  const prior = getPriorCompletedAudit(db, audit.url, auditId)
  return NextResponse.json({ audit, prior })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = getDb()
  deleteAudit(db, Number(id))
  return new NextResponse(null, { status: 204 })
}
