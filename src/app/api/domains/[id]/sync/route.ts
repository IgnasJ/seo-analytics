import { NextRequest, NextResponse } from "next/server"
import { syncDomain } from "@/lib/sync"
import { InvalidGrantError } from "@/lib/google/oauth"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const domainId = Number(id)
  if (isNaN(domainId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  try {
    await syncDomain(domainId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof InvalidGrantError) {
      return NextResponse.json({ error: "reauth_required" }, { status: 401 })
    }
    console.error("Sync error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
