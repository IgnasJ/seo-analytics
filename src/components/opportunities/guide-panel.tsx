"use client"

import { useCallback, useEffect, useRef, useState, useMemo } from "react"
import { formatDateTime } from "@/lib/format"
import type { GuideWithSteps, GuideStepRow } from "@/lib/db/queries/guides"

interface Props {
  domainId: number
  url: string
  query: string
}

type Section = "optimize" | "new_page"

function streamPhase(text: string): string {
  if (!text) return "Starting…"
  if (/create new pages/i.test(text)) return "Writing new page suggestions…"
  if (/optimize this page/i.test(text)) return "Writing optimization steps…"
  return "Analysing your page data…"
}

function forecastColour(forecast: string): string {
  if (/lcp|tbt|cls|performance|perf|speed|fcp/i.test(forecast)) return "text-green-600"
  if (/ctr|click|traffic|impr/i.test(forecast)) return "text-amber-600"
  return "text-muted-foreground"
}

function StepList({
  steps,
  section,
  onToggle,
}: {
  steps: GuideStepRow[]
  section: Section
  onToggle: (stepId: number, done: boolean) => void
}) {
  const filtered = steps.filter((s) => s.section === section)
  if (filtered.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5">
      {filtered.map((step) => (
        <label
          key={step.id}
          className={`flex items-start gap-2 px-2.5 py-2 bg-background border rounded-md cursor-pointer transition-opacity ${step.done ? "opacity-50" : ""}`}
        >
          <input
            type="checkbox"
            suppressHydrationWarning
            checked={step.done === 1}
            onChange={(e) => onToggle(step.id, e.target.checked)}
            className="mt-0.5 shrink-0"
          />
          <div>
            <span className={`text-sm ${step.done ? "line-through" : ""}`}>{step.text}</span>
            {step.forecast && (
              <div className={`text-xs mt-0.5 ${forecastColour(step.forecast)}`}>
                Forecast: {step.forecast}
              </div>
            )}
          </div>
        </label>
      ))}
    </div>
  )
}

export function GuidePanel({ domainId, url, query }: Props) {
  const [active, setActive] = useState<GuideWithSteps | null | undefined>(undefined)
  const [previous, setPrevious] = useState<GuideWithSteps | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [streamText, setStreamText] = useState("")
  const [streamError, setStreamError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!streaming) return
    setProgress(0)
    const tick = setInterval(() => {
      setProgress((p) => (p < 85 ? p + 85 / 20 : p))
    }, 1000)
    return () => clearInterval(tick)
  }, [streaming])

  const phase = useMemo(() => streamPhase(streamText), [streamText])

  const loadGuide = useCallback(async () => {
    const res = await fetch(
      `/api/guides?domainId=${domainId}&url=${encodeURIComponent(url)}&query=${encodeURIComponent(query)}`
    )
    if (!res.ok) return
    const body = await res.json() as { active: GuideWithSteps | null; previous: GuideWithSteps | null }
    setActive(body.active)
    setPrevious(body.previous)
  }, [domainId, url, query])

  useEffect(() => { loadGuide() }, [loadGuide])

  async function generate() {
    setStreaming(true)
    setStreamText("")
    setStreamError(null)
    abortRef.current = new AbortController()

    try {
      const res = await fetch("/api/guides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId, url, query }),
        signal: abortRef.current.signal,
      })
      if (!res.body) return

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
          const payload = line.slice(6)
          try {
            const event = JSON.parse(payload) as { type: string; text?: string; guide?: GuideWithSteps; message?: string }
            if (event.type === "chunk" && event.text) {
              setStreamText((t) => t + event.text)
            } else if (event.type === "done" && event.guide) {
              setActive(event.guide)
              await loadGuide()
            } else if (event.type === "error" && event.message) {
              setStreamError(event.message)
            }
          } catch { /* skip */ }
        }
      }
    } finally {
      setStreaming(false)
    }
  }

  async function toggleStep(stepId: number, done: boolean) {
    if (!active) return
    await fetch(`/api/guides/${active.id}/steps/${stepId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done }),
    })
    setActive((g) =>
      g
        ? {
            ...g,
            steps: g.steps.map((s) =>
              s.id === stepId ? { ...s, done: done ? 1 : 0, done_at: done ? Math.floor(Date.now() / 1000) : null } : s
            ),
          }
        : g
    )
  }

  // Not yet loaded
  if (active === undefined) return null

  // No guide yet — show generate button
  if (!active && !streaming) {
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={generate}
          className="text-xs px-3 py-1.5 border rounded-md hover:bg-muted transition-colors"
        >
          Generate guide
        </button>
      </div>
    )
  }

  // Streaming state (or error after streaming)
  if (streaming || streamError) {
    return (
      <div className="mt-3 border rounded-md p-3 space-y-2">
        {streamError ? (
          <>
            <p className="text-xs text-red-600">Generation failed: {streamError}</p>
            <button type="button" onClick={() => setStreamError(null)} className="text-xs text-muted-foreground underline">Dismiss</button>
          </>
        ) : (
          <>
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{phase}</p>
          </>
        )}
      </div>
    )
  }

  // Saved guide
  const optimizeSteps = active!.steps.filter((s) => s.section === "optimize")
  const newPageSteps = active!.steps.filter((s) => s.section === "new_page")
  const doneCount = active!.steps.filter((s) => s.done).length
  const totalCount = active!.steps.length

  return (
    <div className="mt-3 border rounded-md p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs font-medium">
          AI guide — {doneCount} / {totalCount} steps done
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {formatDateTime(active!.generated_at)} · {active!.model}
          </span>
          <button
            type="button"
            onClick={generate}
            className="text-xs px-2 py-0.5 border rounded hover:bg-muted transition-colors"
          >
            Regenerate
          </button>
        </div>
      </div>

      {/* Optimize section */}
      {optimizeSteps.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              Optimise this page
            </span>
          </div>
          <StepList steps={active!.steps} section="optimize" onToggle={toggleStep} />
        </div>
      )}

      {/* New pages section */}
      {newPageSteps.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              Consider new pages
            </span>
          </div>
          <StepList steps={active!.steps} section="new_page" onToggle={toggleStep} />
        </div>
      )}

      {/* Raw output — shown when parsing produced no steps */}
      {totalCount === 0 && active!.raw_markdown && (
        <details className="border-t pt-2">
          <summary className="text-xs text-amber-600 cursor-pointer">
            No steps parsed — view raw AI output
          </summary>
          <pre className="mt-2 text-xs font-mono whitespace-pre-wrap bg-muted rounded p-2 leading-relaxed">
            {active!.raw_markdown}
          </pre>
        </details>
      )}

      {/* Previous guide disclosure */}
      {previous && (
        <details className="border-t pt-2">
          <summary className="text-xs text-muted-foreground cursor-pointer">
            Previous guide: {previous.steps.filter((s) => s.done).length} / {previous.steps.length} steps done
            {previous.superseded_at && ` · ${formatDateTime(previous.superseded_at)}`}
          </summary>
          <div className="mt-2 space-y-1.5 opacity-60 pointer-events-none">
            <StepList steps={previous.steps} section="optimize" onToggle={() => {}} />
            <StepList steps={previous.steps} section="new_page" onToggle={() => {}} />
          </div>
        </details>
      )}
    </div>
  )
}
