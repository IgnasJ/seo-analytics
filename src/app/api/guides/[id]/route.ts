import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { deleteGuide } from "@/lib/db/queries/guides"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = getDb()
  deleteGuide(db, Number(id))
  return NextResponse.json({ ok: true })
}
