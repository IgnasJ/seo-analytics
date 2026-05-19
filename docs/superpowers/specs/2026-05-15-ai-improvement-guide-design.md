# AI Improvement Guide — Design Spec

**Date:** 2026-05-15  
**Status:** Approved  

---

## Overview

When a user expands a keyword row in the Opportunities tab, they can click **"Generate guide"** to produce a context-aware, AI-powered improvement plan for that page. The guide analyses all GSC keywords ranking for that URL, cross-references the latest Lighthouse audit and a live page fetch, then produces:

1. **Optimise this page** — numbered steps for keywords that belong on the existing page, each with a forecast metric impact
2. **Consider new pages** — keywords with divergent search intent where a dedicated new article would perform better, each with a suggested title and traffic forecast

Guides are saved to SQLite, steps are individually checkable, and old guides are preserved when regenerated (not deleted).

---

## Architecture

### Runner abstraction

The app never calls the AI CLI directly. All guide generation goes through an `AIRunner` interface with two implementations selected by env var:

```
AI_RUNNER=local   → child_process.spawn("claude", ["--print", "--model", MODEL, ...])
AI_RUNNER=remote  → fetch(AI_RUNNER_URL + "/run", { body: JSON.stringify({prompt, model, systemPrompt}) })
```

**Local mode** is used for development (CLI installed on the same machine).  
**Remote mode** is used on VPS/Docker where the CLI runs in a companion container.

### ai-runner companion container

A minimal Node.js HTTP server that wraps the CLI and streams its stdout as SSE.

**`docker/ai-runner/Dockerfile`:**
```dockerfile
FROM node:20-alpine
RUN apk add --no-cache git curl jq bash
RUN npm install -g @anthropic-ai/claude-code@latest
COPY server.js .
EXPOSE 3001
CMD ["node", "server.js"]
```

**`docker/ai-runner/server.js`** (~50 lines):
- Listens on port 3001
- `POST /run` accepts `{ prompt, model, systemPrompt }`
- Spawns `claude --print --model <model> --append-system-prompt "<systemPrompt>"`, writes prompt to stdin
- Pipes stdout as `text/event-stream` chunks (`data: <json-encoded-chunk>\n\n`)
- Sends `data: [DONE]\n\n` on process exit
- `GET /ping` returns `{ version: "<claude --version output>" }` for settings test

**`docker-compose.yml` addition:**
```yaml
ai-runner:
  build: ./docker/ai-runner
  environment:
    - MODEL=${AI_MODEL:-claude-sonnet-4-6}
    - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
  restart: unless-stopped
```

The `app` service adds:
```yaml
environment:
  - AI_RUNNER=${AI_RUNNER:-local}
  - AI_RUNNER_URL=${AI_RUNNER_URL:-http://ai-runner:3001}
  - AI_MODEL=${AI_MODEL:-claude-sonnet-4-6}
  - AI_CLI=${AI_CLI:-claude}
```

---

## Database Schema

Three new tables, added via the existing idempotent migration pattern (`runMigrations` in `src/lib/db/index.ts`):

```sql
-- Generic key/value store for app settings (AI runner config, system prompt, etc.)
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS guides (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  domain_id     INTEGER NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  query         TEXT NOT NULL,
  model         TEXT NOT NULL,
  raw_markdown  TEXT NOT NULL,
  generated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  superseded_at INTEGER   -- NULL = active; set when a newer guide replaces this one
);

CREATE TABLE IF NOT EXISTS guide_steps (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  guide_id  INTEGER NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
  position  INTEGER NOT NULL,
  section   TEXT NOT NULL CHECK(section IN ('optimize', 'new_page')),
  text      TEXT NOT NULL,
  forecast  TEXT,          -- e.g. "LCP 3.8s → ~2.4s · Performance +8–12 pts"
  done      INTEGER NOT NULL DEFAULT 0,
  done_at   INTEGER
);
```

**Regenerate behaviour:** `POST /api/guides` finds the active guide for `(domain_id, url, query)`, sets `superseded_at = unixepoch()`, then streams and saves a new guide. Old steps are preserved via cascade on the old guide row. The UI shows "Previous guide: N / M steps done · X days ago" as a collapsed disclosure.

---

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/guides` | Build context → stream SSE from runner → on `[DONE]` parse steps → save to DB → send `{id, steps}` event |
| `GET` | `/api/guides?domainId=&url=&query=` | Return active guide + steps; `null` if none exists |
| `PATCH` | `/api/guides/:id/steps/:stepId` | Toggle `done` (sets/clears `done_at`) |
| `DELETE` | `/api/guides/:id` | Hard delete (used only for manual cleanup; regenerate uses supersede) |
| `GET` | `/api/guides/ping` | Proxy to runner `GET /ping`; returns CLI version for settings test |

### POST /api/guides — context assembly

Before calling the runner, the route assembles three data sources:

1. **GSC keywords for this URL** — all rows from `search_console_cache` where `page = url`, ordered by impressions DESC, last 30 days. Passed as a numbered list with position/impressions/CTR per keyword. The clicked keyword is marked `[SELECTED]`.

2. **Latest Lighthouse audit** — most recent `done` audit from `audits` table for this URL. Extracts: performance score, SEO score, LCP, CLS, TBT, failing audit titles (from `result_json`).

3. **Live page fetch** — `fetch(url)`, parse HTML with a lightweight regex/parser: extract `<title>`, first `<h1>`, `<meta name="description">`. Timeout: 8s. If fetch fails, the field is marked `UNAVAILABLE` and generation continues.

### SSE stream phases

```
data: {"type":"chunk","text":"..."}    ← one per CLI stdout chunk, streamed to browser
data: {"type":"done","guide":{...}}    ← after parse+save; contains full guide object
data: {"type":"error","message":"..."}  ← if CLI exits non-zero
```

---

## Prompt

### System prompt (editable in settings, stored in `settings` table under key `ai_guide_system_prompt`)

```
You are an SEO expert. Given a page's Search Console data, Lighthouse audit results, and live page content, produce a prioritised improvement guide.

First, group all the provided keywords by search intent. Identify which keywords are best served by optimising the existing page versus creating a new dedicated page.

Output two sections using these exact headers:
## OPTIMIZE THIS PAGE
## CREATE NEW PAGES

Under OPTIMIZE THIS PAGE, list numbered steps. Each step must follow this format:
<action text> | Forecast: <specific metric impact>

Under CREATE NEW PAGES, list numbered items. Each must follow this format:
<keyword> — <suggested article title> | Forecast: <traffic opportunity>

Rules:
- 4–7 steps per section maximum (omit a section entirely if empty)
- Reference specific numbers from the data provided (position, LCP value, CTR gap, failing audit names)
- Order each section by highest estimated impact first
- No intro sentence, no conclusion paragraph, no extra markdown
```

### User prompt template (assembled at runtime, read-only)

```
URL: {url}
Target query: "{query}"

All keywords ranking for this URL (GSC, last 30d):
{keywords_list}   ← "1. "how to improve…" — pos 7.2, 3,400 impr, 1.2% CTR [SELECTED]"

Lighthouse ({audit_age}): Performance {perf}, SEO {seo}, LCP {lcp}s, CLS {cls}, TBT {tbt}ms
Failing audits: {failing_audit_titles}

Page (live fetch): Title "{title}", H1 "{h1}", meta description: {meta_desc_or_MISSING}

Produce the improvement guide.
```

### Output parsing

Split raw markdown at `## OPTIMIZE THIS PAGE` and `## CREATE NEW PAGES`. Within each section, each non-empty line matching `/^\d+\.\s+(.+?)\s+\|\s+Forecast:\s+(.+)$/` becomes a `guide_steps` row with `section='optimize'` or `section='new_page'`, `text` and `forecast` fields populated.

Lines that don't match the pattern are appended to the previous step's text (handles multi-line wrapping).

---

## Settings Page

A new **"AI Runner"** card on `/settings` with:

- **CLI tool** — `<select>`: `claude` / `codex`
- **Model** — `<input>` (default `claude-sonnet-4-6`)
- **Runner mode** — toggle: `local` / `remote`
- **Remote URL** — `<input>`, enabled only when remote (placeholder `http://ai-runner:3001`)
- **Test connection** — `GET /api/guides/ping`; shows green "claude 1.x.x detected" or red error message
- **System prompt** — `<textarea>` (editable, "Reset to default" link restores the default above)
- **User prompt template** — read-only `<pre>` showing the assembled template variables

Settings saved to the existing `settings` table (key/value rows).

---

## UI — Opportunities Tab

### Expanded row states

**State 1 — No guide:**  
Static checklist as today. Plain "Generate guide" button (no icon) in the actions column.

**State 2 — Streaming:**  
Button replaced by "Generating… ~20s" label. Raw markdown streams into a `<pre>`-style box with a blinking cursor. The static checklist is hidden during streaming.

**State 3 — Guide saved:**  
```
[Guide header: "AI guide — 2 / 5 steps done" | "Generated just now · claude-sonnet-4-6" | [Regenerate]]

[▶ Detected context — 5 keywords · Lighthouse 58 perf · LCP 3.8s · meta desc missing]  ← collapsed <details>
   Inside: 3-panel grid — Search Console data | Lighthouse metrics | Live page fetch results

[Blue badge: Optimise this page]  3 keywords fit here: "…", "…", "…"
  ☑ (done, strikethrough) Step text
      Forecast: LCP 3.8s → ~2.4s · Performance +8–12 pts
  ☑ (done, strikethrough) Step text
      Forecast: CTR +1–2% → ~20–40 extra clicks/month
  ☐ Step text
      Forecast: position #7.2 → #5–6 within 4–8 weeks
  ... (up to 7 steps)

[Amber badge: Consider new pages]  2 keywords have different intent
  ☐ "best landing page builders" — pos 18.3, 2,100 impr/mo
      Create: "Best Landing Page Builders in 2025: Tested & Ranked"
      Forecast: 2,100 impr/mo opportunity · +80–180 clicks if top 5
  ☐ "landing page examples" — pos 9.8, 4,500 impr/mo
      Create: "25 High-Converting Landing Page Examples (2025)"
      Forecast: highest traffic potential of all keywords on this URL

[▶ Previous guide: 3 / 6 steps done · 3 days ago]   ← collapsed, shows old steps read-only
```

### Forecast colour coding
- **Green** — performance/speed wins (LCP, TBT, Performance score)
- **Amber** — traffic/CTR wins (clicks, CTR improvement)
- **Grey** — ranking estimates (position change, timeline)

---

## Out of Scope

- Cross-domain keyword analysis (only keywords for the selected URL's domain)
- Automated execution of steps (the tool advises; the user acts)
- Guide generation from the Audit tab (future feature, not this spec)
- Email/notification when guide is ready (guide streams synchronously; no background queue needed)
