import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getActiveGuide, getPreviousGuide, createGuide, createGuideSteps, supersedeActiveGuide } from "@/lib/db/queries/guides"
import { getRunner } from "@/lib/ai-runner"
import { sseResponse } from "@/lib/ai-runner/sse"
import { buildUserPrompt, DEFAULT_SYSTEM_PROMPT } from "@/lib/ai-runner/prompt"
import { parseGuideMarkdown } from "@/lib/ai-runner/parse"
import { assembleGuideContext } from "@/lib/ai-runner/context"
import { getSetting } from "@/lib/db/queries/settings"

export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const domainId = Number(sp.get("domainId"))
  const url = sp.get("url") ?? ""
  const query = sp.get("query") ?? ""

  if (!domainId || !url || !query) {
    return NextResponse.json({ error: "domainId, url, query required" }, { status: 400 })
  }

  const db = getDb()
  const active = getActiveGuide(db, domainId, url, query)
  const previous = getPreviousGuide(db, domainId, url, query)

  return NextResponse.json({ active, previous })
}

/**
 * True when `urlHostname` is the tracked hostname or a subdomain of it. A bare
 * `endsWith(hostname)` also accepted look-alikes such as `evil-example.com`
 * for `example.com`, which let the page fetcher be pointed at foreign hosts.
 */
function belongsToDomain(urlHostname: string, domainHostname: string): boolean {
  const host = urlHostname.toLowerCase()
  const domain = domainHostname.toLowerCase()
  return host === domain || host.endsWith(`.${domain}`)
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    domainId?: unknown; url?: unknown; query?: unknown
  } | null
  const domainId = Number(body?.domainId)
  const url = typeof body?.url === "string" ? body.url : ""
  const query = typeof body?.query === "string" ? body.query : ""
  if (!Number.isInteger(domainId) || domainId <= 0 || !url || !query) {
    return NextResponse.json({ error: "domainId, url, query required" }, { status: 400 })
  }

  // Validate URL is http(s) and cap query length
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 })
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 })
  }
  if (query.length > 300) {
    return NextResponse.json({ error: "query too long" }, { status: 400 })
  }

  const db = getDb()

  // Verify the domain owns this URL
  const domain = db.query<{ hostname: string }, [number]>(
    "SELECT hostname FROM domains WHERE id = ?"
  ).get(domainId)
  if (!domain) {
    return NextResponse.json({ error: "domain not found" }, { status: 404 })
  }
  if (!belongsToDomain(parsedUrl.hostname, domain.hostname)) {
    return NextResponse.json({ error: "url does not belong to this domain" }, { status: 403 })
  }

  const model = getSetting(db, "ai_model") || process.env.AI_MODEL || undefined
  const systemPrompt =
    getSetting(db, "ai_guide_system_prompt") || DEFAULT_SYSTEM_PROMPT

  // Resolve the runner before doing any work so a bad configuration comes back
  // as a readable JSON error rather than an opaque 500.
  let runner
  try {
    runner = getRunner({
      mode: getSetting(db, "ai_runner") ?? undefined,
      url: getSetting(db, "ai_runner_url") ?? undefined,
      cli: getSetting(db, "ai_cli") ?? undefined,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI runner misconfigured" },
      { status: 400 }
    )
  }

  const ctx = await assembleGuideContext(db, domainId, url, query)
  const userPrompt = buildUserPrompt(ctx)

  return sseResponse(req.signal, async (send, signal) => {
    let rawMarkdown = ""
    for await (const event of runner.stream(userPrompt, systemPrompt, model, signal)) {
      if (event.type === "chunk") {
        rawMarkdown += event.text
        send({ type: "chunk", text: event.text })
      } else if (event.type === "error") {
        send({ type: "error", message: event.message })
        return
      } else if (event.type === "done") {
        supersedeActiveGuide(db, domainId, url, query)
        const guide = createGuide(db, { domainId, url, query, model: model ?? "default", rawMarkdown })
        const parsed = parseGuideMarkdown(rawMarkdown)
        const allSteps = [...parsed.optimize, ...parsed.new_page]
        createGuideSteps(db, guide.id, allSteps)

        const saved = getActiveGuide(db, domainId, url, query)
        send({ type: "done", guide: saved })
        return
      }
    }
  })
}
