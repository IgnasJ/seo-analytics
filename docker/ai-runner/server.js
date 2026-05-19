const { createServer } = require("http")
const { spawn } = require("child_process")

const CLI = process.env.AI_CLI || "claude"
const DEFAULT_MODEL = process.env.MODEL || "claude-sonnet-4-6"

createServer((req, res) => {
  const url = new URL(req.url, "http://localhost")

  if (req.method === "GET" && url.pathname === "/ping") {
    const proc = spawn(CLI, ["--version"])
    let out = ""
    proc.stdout.on("data", (d) => { out += d.toString() })
    proc.on("close", () => {
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ version: out.trim() }))
    })
    return
  }

  if (req.method === "POST" && url.pathname === "/run") {
    let body = ""
    req.on("data", (d) => { body += d })
    req.on("end", () => {
      let parsed
      try { parsed = JSON.parse(body) } catch {
        res.writeHead(400)
        res.end("bad json")
        return
      }
      const { prompt, model = DEFAULT_MODEL, systemPrompt = "" } = parsed

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      })

      const args = ["--print"]
      if (model) args.push("--model", model)
      if (systemPrompt) args.push("--append-system-prompt", systemPrompt)

      const proc = spawn(CLI, args)
      proc.stdin.end(prompt)

      proc.stdout.on("data", (chunk) => {
        res.write(`data: ${JSON.stringify(chunk.toString())}\n\n`)
      })

      proc.stderr.on("data", (chunk) => {
        console.error("[ai-runner stderr]", chunk.toString())
      })

      proc.on("close", (code) => {
        if (code !== 0) {
          res.write(`data: ${JSON.stringify({ __error: `CLI exited ${code}` })}\n\n`)
        }
        res.write("data: [DONE]\n\n")
        res.end()
      })
    })
    return
  }

  res.writeHead(404)
  res.end()
}).listen(3001, () => {
  console.log("ai-runner listening on :3001")
})
