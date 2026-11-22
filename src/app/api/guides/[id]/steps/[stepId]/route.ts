import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { toggleGuideStep } from "@/lib/db/queries/guides"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  const { stepId } = await params
  const id = Number(stepId)
  const body = (await req.json().catch(() => null)) as { done?: unknown } | null
  if (!Number.isInteger(id) || typeof body?.done !== "boolean") {
    return NextResponse.json({ error: "stepId and boolean done required" }, { status: 400 })
  }
  const db = getDb()
  toggleGuideStep(db, id, body.done)
  return NextResponse.json({ ok: true })
}
