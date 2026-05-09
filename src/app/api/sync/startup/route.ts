import { NextResponse } from "next/server"
import { startupSync } from "@/lib/sync"

export async function POST() {
  try {
    await startupSync()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("Startup sync error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
