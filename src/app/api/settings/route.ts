import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getSetting, setSetting } from "@/lib/db/queries/settings"

const ALLOWED_KEYS = [
  "ai_cli",
  "ai_runner",
  "ai_runner_url",
  "ai_model",
  "ai_guide_system_prompt",
] as const

export function GET() {
  const db = getDb()
  const result: Record<string, string | null> = {}
  for (const key of ALLOWED_KEYS) {
    result[key] = getSetting(db, key)
  }
  return NextResponse.json(result)
}

export async function PATCH(req: NextRequest) {
  const body = await req.json() as Record<string, string>
  const db = getDb()
  for (const [key, value] of Object.entries(body)) {
    if ((ALLOWED_KEYS as readonly string[]).includes(key)) {
      setSetting(db, key, value)
    }
  }
  return NextResponse.json({ ok: true })
}
