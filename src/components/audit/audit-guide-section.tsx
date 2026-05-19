"use client"

import { useState } from "react"
import { GuidePanel } from "@/components/opportunities/guide-panel"

// Sentinel used when no keyword is selected — generates a general page guide.
const GENERAL = "(general improvement)"

interface Keyword {
  query: string
  impressions: number
  position: number
}

export function AuditGuideSection({
  url,
  domainId,
  keywords,
}: {
  url: string
  domainId: number
  keywords: Keyword[]
}) {
  const [selectedChip, setSelectedChip] = useState(keywords[0]?.query ?? GENERAL)
  const [customInput, setCustomInput] = useState("")
  const [activeQuery, setActiveQuery] = useState(keywords[0]?.query ?? GENERAL)

  function selectChip(query: string) {
    setSelectedChip(query)
    setCustomInput("")
    setActiveQuery(query)
  }

  function clearToGeneral() {
    setSelectedChip(GENERAL)
    setCustomInput("")
    setActiveQuery(GENERAL)
  }

  function commitCustom() {
    const q = customInput.trim()
    if (!q) return
    setSelectedChip("")
    setActiveQuery(q)
  }

  const isGeneral = activeQuery === GENERAL

  return (
    <div className="space-y-3">
      {/* Keyword chips from GSC */}
      {keywords.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Keywords ranking for this page — select one to focus the guide, or leave on General:
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={clearToGeneral}
              className={`text-xs px-2.5 py-1 border rounded-full transition-colors ${
                isGeneral
                  ? "bg-foreground text-background border-foreground"
                  : "hover:bg-muted"
              }`}
            >
              General
            </button>
            {keywords.map((kw) => (
              <button
                key={kw.query}
                type="button"
                onClick={() => selectChip(kw.query)}
                className={`text-xs px-2.5 py-1 border rounded-full transition-colors inline-flex items-center gap-1.5 ${
                  selectedChip === kw.query
                    ? "bg-foreground text-background border-foreground"
                    : "hover:bg-muted"
                }`}
              >
                {kw.query}
                <span className="opacity-60 font-mono">#{Math.round(kw.position)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Custom keyword input */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground shrink-0">Custom keyword:</label>
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onBlur={commitCustom}
          onKeyDown={(e) => { if (e.key === "Enter") commitCustom() }}
          placeholder="Enter keyword and press Enter to focus guide…"
          className="flex-1 border rounded px-2 py-1 text-xs"
          suppressHydrationWarning
        />
      </div>

      {/* Guide panel — always rendered, keyword is optional */}
      <GuidePanel key={activeQuery} domainId={domainId} url={url} query={activeQuery} />
    </div>
  )
}
