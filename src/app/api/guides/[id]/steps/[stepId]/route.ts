import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { toggleGuideStep } from "@/lib/db/queries/guides"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  const { stepId } = await params
  const { done } = await req.json() as { done: boolean }
  const db = getDb()
  toggleGuideStep(db, Number(stepId), done)
  return NextResponse.json({ ok: true })
}
