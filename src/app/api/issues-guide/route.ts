import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getDomain } from "@/lib/db/queries/domains"
import { getIssuesCache } from "@/lib/db/queries/cache"
import { getRunner } from "@/lib/ai-runner"
import { getSetting } from "@/lib/db/queries/settings"
import type { IssuesReport } from "@/types/search-console"

const SYSTEM_PROMPT = `You are a web performance and technical SEO expert. Given Core Web Vitals field data (from real users via CrUX) and sitemap indexing health, produce a prioritised action plan to fix the detected issues.

Output two sections (omit any section with no relevant issues):
## FIX PERFORMANCE
## FIX INDEXING

Under each section, list numbered steps in this exact format:
<action text> | Impact: <expected improvement>

Rules:
- 4–8 steps per section maximum
- Reference specific percentages, metric names, and error counts from the data
- Order by highest expected impact first
- No intro sentence, no conclusion, no extra markdown`

function buildPrompt(hostname: string, issues: IssuesReport): string {
  function cwvLine(name: string, m: { good: number; needsImprovement: number; poor: number } | null) {
    if (!m) return `${name}: no CrUX data yet`
    return `${name}: ${m.good}% good / ${m.needsImprovement}% needs improvement / ${m.poor}% poor (target: 75%+ good)`
  }

  const lines = [
    `Domain: ${hostname}`,
    "",
    "Core Web Vitals (CrUX real-user field data):",
    cwvLine("LCP (Largest Contentful Paint)", issues.cwv.lcp),
    cwvLine("CLS (Cumulative Layout Shift)", issues.cwv.cls),
    cwvLine("INP (Interaction to Next Paint)", issues.cwv.inp),
  ]

  if (issues.sitemaps.length > 0) {
    lines.push("", "Sitemap health:")
    for (const sm of issues.sitemaps) {
      const coverage = sm.submitted > 0 ? Math.round((sm.indexed / sm.submitted) * 100) : 0
      lines.push(
        `${sm.path} — ${sm.submitted} submitted, ${sm.indexed} indexed (${coverage}% coverage), ${sm.errors} errors, ${sm.warnings} warnings`
      )
    }
  } else {
    lines.push("", "Sitemaps: none submitted")
  }

  lines.push("", "Generate the fix plan.")
  return lines.join("\n")
}

export async function POST(req: NextRequest) {
  const { domainId } = await req.json() as { domainId: number }
  if (!domainId) return NextResponse.json({ error: "domainId required" }, { status: 400 })

  const db = getDb()
  const domain = getDomain(db, domainId)
  if (!domain) return NextResponse.json({ error: "domain not found" }, { status: 404 })

  const issues = getIssuesCache(db, domainId) as IssuesReport | null
  if (!issues) return NextResponse.json({ error: "no issues data — sync this domain first" }, { status: 404 })

  const prompt = buildPrompt(domain.hostname, issues)
  const model = getSetting(db, "ai_model") || process.env.AI_MODEL || undefined

  const runner = getRunner({
    mode: getSetting(db, "ai_runner") ?? undefined,
    url: getSetting(db, "ai_runner_url") ?? undefined,
    cli: getSetting(db, "ai_cli") ?? undefined,
  })

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      function send(obj: unknown) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`))
      }
      try {
        let markdown = ""
        for await (const event of runner.stream(prompt, SYSTEM_PROMPT, model)) {
          if (event.type === "chunk") {
            markdown += event.text
            send({ type: "chunk", text: event.text })
          } else if (event.type === "error") {
            send({ type: "error", message: event.message })
            controller.close()
            return
          } else if (event.type === "done") {
            send({ type: "done", markdown })
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
