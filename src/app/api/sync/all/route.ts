import { NextResponse } from "next/server"
import { syncAllDomains } from "@/lib/sync"

export async function POST() {
  try {
    const result = await syncAllDomains()
    return NextResponse.json(result)
  } catch (err) {
    console.error("Sync-all error:", err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
