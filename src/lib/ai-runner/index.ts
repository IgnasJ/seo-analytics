import { spawn } from "child_process"

export interface RunnerChunk {
  type: "chunk"
  text: string
}

export interface RunnerDone {
  type: "done"
}

export interface RunnerError {
  type: "error"
  message: string
}

export type RunnerEvent = RunnerChunk | RunnerDone | RunnerError

export interface AIRunner {
  stream(prompt: string, systemPrompt: string, model?: string): AsyncGenerator<RunnerEvent>
  ping(): Promise<string>
}

class LocalRunner implements AIRunner {
  constructor(private readonly cli: string) {}

  async *stream(prompt: string, systemPrompt: string, model?: string): AsyncGenerator<RunnerEvent> {
    const args = ["--print", ...(model ? ["--model", model] : []), "--append-system-prompt", systemPrompt]
    const proc = spawn(this.cli, args)

    proc.stdin.end(prompt)

    let stderr = ""
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString() })

    let spawnError: Error | null = null
    proc.on("error", (err) => { spawnError = err })

    for await (const chunk of proc.stdout) {
      yield { type: "chunk", text: (chunk as Buffer).toString() }
    }

    yield await new Promise<RunnerEvent>((resolve) => {
      proc.on("close", (code) => {
        if (spawnError) {
          resolve({ type: "error", message: spawnError.message })
        } else if (code === 0) {
          resolve({ type: "done" })
        } else {
          resolve({ type: "error", message: stderr || `CLI exited with code ${code}` })
        }
      })
    })
  }

  async ping(): Promise<string> {
    return new Promise((resolve, reject) => {
      let out = ""
      const proc = spawn(this.cli, ["--version"], { shell: true })
      const timer = setTimeout(() => {
        proc.kill()
        reject(new Error("ping timed out"))
      }, 8000)
      proc.stdout.on("data", (d: Buffer) => { out += d.toString() })
      proc.on("error", (err) => { clearTimeout(timer); reject(err) })
      proc.on("close", (code) => {
        clearTimeout(timer)
        if (code === 0) resolve(out.trim())
        else reject(new Error(`CLI version check failed (code ${code})`))
      })
    })
  }
}

class RemoteRunner implements AIRunner {
  constructor(private readonly baseUrl: string) {}

  async *stream(prompt: string, systemPrompt: string, model?: string): AsyncGenerator<RunnerEvent> {
    const res = await fetch(`${this.baseUrl}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, systemPrompt, ...(model ? { model } : {}) }),
    })

    if (!res.ok || !res.body) {
      yield { type: "error", message: `Runner responded ${res.status}` }
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue
        const payload = line.slice(6)
        if (payload === "[DONE]") {
          yield { type: "done" }
          return
        }
        try {
          const text = JSON.parse(payload) as string
          yield { type: "chunk", text }
        } catch {
          // skip malformed lines
        }
      }
    }
  }

  async ping(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/ping`)
    if (!res.ok) throw new Error(`Ping failed: ${res.status}`)
    const body = await res.json() as { version: string }
    return body.version
  }
}

interface RunnerConfig {
  mode?: string
  url?: string
  cli?: string
}

export function getRunner(config?: RunnerConfig): AIRunner {
  const mode = config?.mode ?? process.env.AI_RUNNER ?? "local"
  if (mode === "remote") {
    const url = config?.url ?? process.env.AI_RUNNER_URL
    if (!url) throw new Error("AI_RUNNER_URL must be set when AI_RUNNER=remote")
    return new RemoteRunner(url)
  }
  const cli = config?.cli ?? process.env.AI_CLI ?? "claude"
  return new LocalRunner(cli)
}
