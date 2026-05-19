export interface ParsedStep {
  position: number
  section: "optimize" | "new_page"
  text: string
  forecast: string | null
}

export interface ParsedGuide {
  optimize: ParsedStep[]
  new_page: ParsedStep[]
}

const STEP_RE = /^\d+\.\s+(.+?)(?:\s+\|\s+Forecast:\s+(.+))?$/

function stripMarkdown(line: string): string {
  return line.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/`(.+?)`/g, "$1")
}

function parseSection(raw: string, section: "optimize" | "new_page"): ParsedStep[] {
  const steps: ParsedStep[] = []
  for (const line of raw.split("\n")) {
    const trimmed = stripMarkdown(line.trim())
    if (!trimmed) continue
    const m = STEP_RE.exec(trimmed)
    if (!m) continue
    steps.push({
      position: steps.length + 1,
      section,
      text: m[1].trim(),
      forecast: m[2]?.trim() ?? null,
    })
  }
  return steps
}

export function parseGuideMarkdown(raw: string): ParsedGuide {
  // Strip code fences the model may wrap its output in
  const text = raw.replace(/^```[^\n]*\n?/gm, "").replace(/^```$/gm, "")

  const optimizeMatch = text.match(/#{1,3}\s*OPTIMIZE THIS PAGE\s*\n([\s\S]*?)(?=#{1,3}\s*CREATE NEW PAGES|$)/i)
  const newPageMatch = text.match(/#{1,3}\s*CREATE NEW PAGES\s*\n([\s\S]*)$/i)

  return {
    optimize: optimizeMatch ? parseSection(optimizeMatch[1], "optimize") : [],
    new_page: newPageMatch ? parseSection(newPageMatch[1], "new_page") : [],
  }
}
