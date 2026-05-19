import { NextRequest, NextResponse } from "next/server"
import { getRunner } from "@/lib/ai-runner"

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const cli = sp.get("cli") ?? undefined
  const mode = sp.get("runner") ?? undefined
  const url = sp.get("url") ?? undefined
  try {
    const version = await getRunner({ cli, mode, url }).ping()
    return NextResponse.json({ version })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ping failed" },
      { status: 503 }
    )
  }
}
