import { NextRequest, NextResponse } from "next/server"
import { syncDomain } from "@/lib/sync"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const domainId = Number(id)
  if (isNaN(domainId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  try {
    await syncDomain(domainId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("Sync error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
