import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getActiveGuide, getPreviousGuide, createGuide, createGuideSteps, supersedeActiveGuide } from "@/lib/db/queries/guides"
import { getRunner } from "@/lib/ai-runner"
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

export async function POST(req: NextRequest) {
  const { domainId, url, query } = await req.json() as {
    domainId: number; url: string; query: string
  }
  if (!domainId || !url || !query) {
    return NextResponse.json({ error: "domainId, url, query required" }, { status: 400 })
  }

  // Validate URL is http(s) and cap query length
  if (!/^https?:\/\//i.test(url)) {
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
  const urlHostname = new URL(url).hostname
  if (!urlHostname.endsWith(domain.hostname) && urlHostname !== domain.hostname) {
    return NextResponse.json({ error: "url does not belong to this domain" }, { status: 403 })
  }

  const model = getSetting(db, "ai_model") || process.env.AI_MODEL || undefined
  const systemPrompt =
    getSetting(db, "ai_guide_system_prompt") ?? DEFAULT_SYSTEM_PROMPT

  const ctx = await assembleGuideContext(db, domainId, url, query)
  const userPrompt = buildUserPrompt(ctx)

  const runner = getRunner({
    mode: getSetting(db, "ai_runner") ?? undefined,
    url: getSetting(db, "ai_runner_url") ?? undefined,
    cli: getSetting(db, "ai_cli") ?? undefined,
  })
  let rawMarkdown = ""

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      function send(obj: unknown) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`))
      }

      try {
        for await (const event of runner.stream(userPrompt, systemPrompt, model)) {
          if (event.type === "chunk") {
            rawMarkdown += event.text
            send({ type: "chunk", text: event.text })
          } else if (event.type === "error") {
            send({ type: "error", message: event.message })
            controller.close()
            return
          } else if (event.type === "done") {
            supersedeActiveGuide(db, domainId, url, query)
            const guide = createGuide(db, { domainId, url, query, model: model ?? "default", rawMarkdown })
            const parsed = parseGuideMarkdown(rawMarkdown)
            const allSteps = [...parsed.optimize, ...parsed.new_page]
            createGuideSteps(db, guide.id, allSteps)

            const saved = getActiveGuide(db, domainId, url, query)
            send({ type: "done", guide: saved })
            controller.close()
            return
          }
        }
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "unknown error" })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  })
}
