"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/ai-runner/prompt"

interface Settings {
  ai_cli: string
  ai_runner: string
  ai_runner_url: string
  ai_model: string
  ai_guide_system_prompt: string
}

const DEFAULTS: Settings = {
  ai_cli: "claude",
  ai_runner: "local",
  ai_runner_url: "http://ai-runner:3001",
  ai_model: "claude-sonnet-4-6",
  ai_guide_system_prompt: DEFAULT_SYSTEM_PROMPT,
}

export function AiRunnerCard() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [pingStatus, setPingStatus] = useState<"idle" | "testing" | "ok" | "error">("idle")
  const [pingMessage, setPingMessage] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((body: Partial<Settings>) => {
        setSettings((prev) => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(body).filter(([, v]) => v !== null)
          ) as Partial<Settings>,
        }))
      })
      .catch(() => {})
  }, [])

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  async function testConnection() {
    setPingStatus("testing")
    setPingMessage("")
    try {
      const params = new URLSearchParams({
        cli: settings.ai_cli,
        runner: settings.ai_runner,
        ...(settings.ai_runner === "remote" ? { url: settings.ai_runner_url } : {}),
      })
      const res = await fetch(`/api/guides/ping?${params}`)
      const body = await res.json() as { version?: string; error?: string }
      if (res.ok && body.version) {
        setPingStatus("ok")
        setPingMessage(body.version)
      } else {
        setPingStatus("error")
        setPingMessage(body.error ?? "Unknown error")
      }
    } catch (err) {
      setPingStatus("error")
      setPingMessage(err instanceof Error ? err.message : "Network error")
    }
  }

  async function save() {
    setSaving(true)
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    })
    setSaving(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">AI Runner</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">CLI Tool</label>
            <select
              value={settings.ai_cli}
              onChange={(e) => {
                set("ai_cli", e.target.value)
                set("ai_model", "")
              }}
              className="w-full border rounded-md px-2 py-1.5 text-sm"
              suppressHydrationWarning
            >
              <option value="claude">claude</option>
              <option value="codex">codex</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Model</label>
            <input
              type="text"
              value={settings.ai_model}
              onChange={(e) => set("ai_model", e.target.value)}
              placeholder="default (CLI picks)"
              className="w-full border rounded-md px-2 py-1.5 text-sm"
              suppressHydrationWarning
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Runner Mode</label>
            <div className="flex w-fit items-center border rounded-md overflow-hidden text-sm">
              {(["local", "remote"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => set("ai_runner", mode)}
                  className={`px-3 py-1.5 transition-colors ${settings.ai_runner === mode ? "bg-foreground text-background" : "hover:bg-muted"}`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Remote URL</label>
            <input
              type="text"
              value={settings.ai_runner_url}
              onChange={(e) => set("ai_runner_url", e.target.value)}
              disabled={settings.ai_runner !== "remote"}
              placeholder="http://ai-runner:3001"
              className="w-full border rounded-md px-2 py-1.5 text-sm disabled:opacity-40"
              suppressHydrationWarning
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" onClick={testConnection} disabled={pingStatus === "testing"}>
            Test connection
          </Button>
          {pingStatus === "ok" && <span className="text-xs text-green-600">✓ {pingMessage}</span>}
          {pingStatus === "error" && <span className="text-xs text-red-600">✗ {pingMessage}</span>}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">System Prompt</label>
            <button
              type="button"
              onClick={() => set("ai_guide_system_prompt", DEFAULT_SYSTEM_PROMPT)}
              className="text-xs text-muted-foreground underline"
            >
              Reset to default
            </button>
          </div>
          <textarea
            value={settings.ai_guide_system_prompt}
            onChange={(e) => set("ai_guide_system_prompt", e.target.value)}
            rows={8}
            className="w-full border rounded-md px-3 py-2 text-xs font-mono resize-y"
            suppressHydrationWarning
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">User Prompt Template (read-only)</label>
          <pre className="text-xs font-mono bg-muted rounded-md p-3 whitespace-pre-wrap text-muted-foreground leading-relaxed">
{`URL: {url}
Target query: "{query}"

All keywords ranking for this URL (GSC, last 30d):
{keywords_list}

Lighthouse ({audit_age}): Performance {perf}, SEO {seo}, LCP {lcp}s, CLS {cls}, TBT {tbt}ms
Failing audits: {failing_audit_titles}

Page (live fetch): Title "{title}", H1 "{h1}", meta description: {meta_desc_or_MISSING}

Produce the improvement guide.`}
          </pre>
        </div>

        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
