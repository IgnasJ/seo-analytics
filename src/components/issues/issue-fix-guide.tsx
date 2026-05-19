"use client"

import { useEffect, useMemo, useRef, useState } from "react"

function streamPhase(text: string): string {
  if (!text) return "Starting…"
  if (/fix indexing/i.test(text)) return "Writing indexing fixes…"
  if (/fix performance/i.test(text)) return "Writing performance fixes…"
  return "Analysing issues…"
}

function renderMarkdown(md: string) {
  const lines = md.split("\n")
  const nodes: React.ReactNode[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const headerMatch = line.match(/^#{1,3}\s+(.+)/)
    const stepMatch = line.match(/^(\d+)\.\s+(.+?)(?:\s+\|\s+Impact:\s+(.+))?$/)

    if (headerMatch) {
      nodes.push(
        <h3 key={i} className="text-sm font-semibold mt-4 mb-1.5 first:mt-0">
          {headerMatch[1]}
        </h3>
      )
    } else if (stepMatch) {
      nodes.push(
        <div key={i} className="flex items-start gap-2 py-2 border-b last:border-0">
          <span className="text-muted-foreground text-xs tabular-nums shrink-0 mt-0.5 w-4">
            {stepMatch[1]}.
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm">{stepMatch[2]}</p>
            {stepMatch[3] && (
              <p className="text-xs text-amber-600 mt-0.5">Impact: {stepMatch[3]}</p>
            )}
          </div>
        </div>
      )
    } else if (line.trim()) {
      nodes.push(
        <p key={i} className="text-sm text-muted-foreground">{line}</p>
      )
    }
  }

  return <div>{nodes}</div>
}

export function IssueFixGuide({ domainId }: { domainId: number }) {
  const [streaming, setStreaming] = useState(false)
  const [streamText, setStreamText] = useState("")
  const [markdown, setMarkdown] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!streaming) return
    setProgress(0)
    const tick = setInterval(() => setProgress((p) => (p < 85 ? p + 85 / 20 : p)), 1000)
    return () => clearInterval(tick)
  }, [streaming])

  const phase = useMemo(() => streamPhase(streamText), [streamText])

  async function generate() {
    setStreaming(true)
    setStreamText("")
    setMarkdown(null)
    setError(null)
    abortRef.current = new AbortController()

    try {
      const res = await fetch("/api/issues-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId }),
        signal: abortRef.current.signal,
      })
      if (!res.body) { setError("No response body"); return }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split("\n")
        buf = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const ev = JSON.parse(line.slice(6)) as {
              type: string; text?: string; markdown?: string; message?: string
            }
            if (ev.type === "chunk" && ev.text) setStreamText((t) => t + ev.text)
            else if (ev.type === "done" && ev.markdown) setMarkdown(ev.markdown)
            else if (ev.type === "error" && ev.message) setError(ev.message)
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") setError(err.message)
    } finally {
      setStreaming(false)
    }
  }

  if (!streaming && !markdown && !error) {
    return (
      <button
        type="button"
        onClick={generate}
        className="text-xs px-3 py-1.5 border rounded-md hover:bg-muted transition-colors"
      >
        Generate fix plan
      </button>
    )
  }

  if (streaming) {
    return (
      <div className="space-y-2">
        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">{phase}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-red-600">Failed: {error}</p>
        <button type="button" onClick={() => setError(null)} className="text-xs text-muted-foreground underline">
          Dismiss
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="border rounded-md p-3">
        {renderMarkdown(markdown!)}
      </div>
      <button
        type="button"
        onClick={generate}
        className="text-xs px-2 py-0.5 border rounded hover:bg-muted transition-colors"
      >
        Regenerate
      </button>
    </div>
  )
}
