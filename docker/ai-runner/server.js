const { createServer } = require("http")
const { spawn } = require("child_process")

const CLI = process.env.AI_CLI || "claude"
const DEFAULT_MODEL = process.env.MODEL || "claude-sonnet-4-6"
// Prompts are a few KB; anything far beyond that is a mistake or abuse.
const MAX_BODY_BYTES = 1024 * 1024

createServer((req, res) => {
  const url = new URL(req.url, "http://localhost")

  if (req.method === "GET" && url.pathname === "/ping") {
    const proc = spawn(CLI, ["--version"])
    let out = ""
    let failed = false
    proc.stdout.on("data", (d) => { out += d.toString() })
    // Without this listener a missing CLI raises an unhandled 'error' event
    // and takes the whole runner process down.
    proc.on("error", (err) => {
      failed = true
      res.writeHead(503, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: err.message }))
    })
    proc.on("close", (code) => {
      if (failed) return
      if (code !== 0) {
        res.writeHead(503, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: `CLI exited ${code}` }))
        return
      }
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ version: out.trim() }))
    })
    return
  }

  if (req.method === "POST" && url.pathname === "/run") {
    let body = ""
    let tooLarge = false
    req.on("data", (d) => {
      if (tooLarge) return
      body += d
      if (body.length > MAX_BODY_BYTES) {
        tooLarge = true
        res.writeHead(413)
        res.end("body too large")
        req.destroy()
      }
    })
    req.on("end", () => {
      if (tooLarge) return
      let parsed
      try { parsed = JSON.parse(body) } catch {
        res.writeHead(400)
        res.end("bad json")
        return
      }
      const { prompt, model = DEFAULT_MODEL, systemPrompt = "" } = parsed
      if (typeof prompt !== "string") {
        res.writeHead(400)
        res.end("prompt required")
        return
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      })

      const args = ["--print"]
      if (model) args.push("--model", String(model))
      if (systemPrompt) args.push("--append-system-prompt", String(systemPrompt))

      const proc = spawn(CLI, args)
      let finished = false

      const finish = (errorMessage) => {
        if (finished) return
        finished = true
        if (errorMessage) {
          res.write(`data: ${JSON.stringify({ __error: errorMessage })}\n\n`)
        }
        res.write("data: [DONE]\n\n")
        res.end()
      }

      proc.on("error", (err) => finish(err.message))
      proc.stdin.on("error", () => {})
      proc.stdin.end(prompt)

      proc.stdout.on("data", (chunk) => {
        res.write(`data: ${JSON.stringify(chunk.toString())}\n\n`)
      })

      proc.stderr.on("data", (chunk) => {
        console.error("[ai-runner stderr]", chunk.toString())
      })

      proc.on("close", (code) => {
        finish(code !== 0 ? `CLI exited ${code}` : undefined)
      })

      // The caller hung up (browser tab closed, request aborted): stop the CLI
      // instead of letting it run to completion with nobody listening.
      res.on("close", () => {
        if (!finished) {
          finished = true
          proc.kill()
        }
      })
    })
    return
  }

  res.writeHead(404)
  res.end()
}).listen(3001, () => {
  console.log("ai-runner listening on :3001")
})
