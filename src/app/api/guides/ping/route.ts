import { NextRequest, NextResponse } from "next/server"
import { getRunner, isAllowedCli, isHttpUrl, RUNNER_MODES } from "@/lib/ai-runner"

/**
 * "Test connection" for the AI runner card. The query params let the settings
 * form test values that aren't saved yet, which makes them attacker-reachable
 * input: every one is validated against a closed set before it gets anywhere
 * near `spawn` / `fetch`. (`cli` used to be passed to a shell verbatim.)
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const cli = sp.get("cli") ?? undefined
  const mode = sp.get("runner") ?? undefined
  const url = sp.get("url") ?? undefined

  if (cli !== undefined && !isAllowedCli(cli)) {
    return NextResponse.json({ error: "Unsupported CLI" }, { status: 400 })
  }
  if (mode !== undefined && !(RUNNER_MODES as readonly string[]).includes(mode)) {
    return NextResponse.json({ error: "Unsupported runner mode" }, { status: 400 })
  }
  if (url !== undefined && !isHttpUrl(url)) {
    return NextResponse.json({ error: "Runner URL must be http(s)" }, { status: 400 })
  }

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
