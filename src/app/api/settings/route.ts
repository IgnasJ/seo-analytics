import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getSetting, setSetting } from "@/lib/db/queries/settings"
import { isAllowedCli, isHttpUrl, RUNNER_MODES } from "@/lib/ai-runner"

const ALLOWED_KEYS = [
  "ai_cli",
  "ai_runner",
  "ai_runner_url",
  "ai_model",
  "ai_guide_system_prompt",
] as const

type SettingKey = (typeof ALLOWED_KEYS)[number]

const MAX_VALUE_LENGTH = 20_000

/**
 * Per-key validation. `ai_cli` and `ai_runner_url` decide which executable is
 * spawned / which host is called, so they must stay inside a closed set — an
 * unvalidated value here is stored command execution. Empty strings are allowed
 * everywhere: they mean "fall back to the environment default".
 */
function validate(key: SettingKey, value: string): string | null {
  if (value.length > MAX_VALUE_LENGTH) return `${key} is too long`
  if (value === "") return null
  switch (key) {
    case "ai_cli":
      return isAllowedCli(value) ? null : "ai_cli must be one of: claude, codex"
    case "ai_runner":
      return (RUNNER_MODES as readonly string[]).includes(value)
        ? null
        : "ai_runner must be local or remote"
    case "ai_runner_url":
      return isHttpUrl(value) ? null : "ai_runner_url must be an http(s) URL"
    case "ai_model":
      // Passed to the CLI as a `--model` argument (no shell involved); keep it
      // to the characters real model ids use so it can't smuggle a flag.
      return /^[A-Za-z0-9][A-Za-z0-9._:\/\-\[\]]{0,99}$/.test(value)
        ? null
        : "ai_model contains unsupported characters"
    default:
      return null
  }
}

export function GET() {
  const db = getDb()
  const result: Record<string, string | null> = {}
  for (const key of ALLOWED_KEYS) {
    result[key] = getSetting(db, key)
  }
  return NextResponse.json(result)
}

export async function PATCH(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "JSON object required" }, { status: 400 })
  }

  // Validate everything first so a bad field can't leave a half-applied update.
  const updates: [SettingKey, string][] = []
  for (const [key, value] of Object.entries(body)) {
    if (!(ALLOWED_KEYS as readonly string[]).includes(key)) continue
    if (typeof value !== "string") {
      return NextResponse.json({ error: `${key} must be a string` }, { status: 400 })
    }
    const problem = validate(key as SettingKey, value)
    if (problem) return NextResponse.json({ error: problem }, { status: 400 })
    updates.push([key as SettingKey, value])
  }

  const db = getDb()
  for (const [key, value] of updates) setSetting(db, key, value)
  return NextResponse.json({ ok: true })
}
