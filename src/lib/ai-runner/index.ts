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
  /**
   * Stream a completion. Pass `signal` so the underlying CLI process / HTTP
   * request is torn down when the browser disconnects — otherwise an abandoned
   * generation keeps a ~200 MB CLI process running to completion.
   */
  stream(
    prompt: string,
    systemPrompt: string,
    model?: string,
    signal?: AbortSignal
  ): AsyncGenerator<RunnerEvent>
  ping(): Promise<string>
}

/**
 * The only executables the local runner may spawn. The CLI name is
 * user-configurable (settings page, `?cli=` on the ping route), so it must
 * never reach `spawn` unchecked: an arbitrary value is arbitrary command
 * execution on the server.
 */
export const ALLOWED_CLIS = ["claude", "codex"] as const
export type AllowedCli = (typeof ALLOWED_CLIS)[number]

export function isAllowedCli(value: unknown): value is AllowedCli {
  return (ALLOWED_CLIS as readonly unknown[]).includes(value)
}

export const RUNNER_MODES = ["local", "remote"] as const

/** True for an absolute http(s) URL — the only shape a remote runner may have. */
export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false
  try {
    const u = new URL(value)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

const PING_TIMEOUT_MS = 8000

class LocalRunner implements AIRunner {
  constructor(private readonly cli: AllowedCli) {}

  async *stream(
    prompt: string,
    systemPrompt: string,
    model?: string,
    signal?: AbortSignal
  ): AsyncGenerator<RunnerEvent> {
    if (signal?.aborted) return

    const args = ["--print", ...(model ? ["--model", model] : []), "--append-system-prompt", systemPrompt]
    // No shell: the prompt-derived arguments must never be shell-interpreted.
    const proc = spawn(this.cli, args)

    let spawnError: Error | null = null
    proc.on("error", (err) => { spawnError = err })
    // A failed spawn (CLI not installed) destroys stdin; without a listener
    // the resulting EPIPE is an unhandled 'error' event that kills the server.
    proc.stdin.on("error", () => {})

    const onAbort = () => { proc.kill() }
    signal?.addEventListener("abort", onAbort, { once: true })

    let stderr = ""
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString() })

    // Register before consuming stdout so a fast exit can't slip past us.
    const closed = new Promise<number | null>((resolve) => {
      proc.on("close", (code) => resolve(code))
    })

    try {
      proc.stdin.end(prompt)

      for await (const chunk of proc.stdout) {
        yield { type: "chunk", text: (chunk as Buffer).toString() }
      }

      const code = await closed
      if (signal?.aborted) return
      if (spawnError) {
        yield { type: "error", message: (spawnError as Error).message }
      } else if (code === 0) {
        yield { type: "done" }
      } else {
        yield { type: "error", message: stderr || `CLI exited with code ${code}` }
      }
    } finally {
      signal?.removeEventListener("abort", onAbort)
      // Reached early when the consumer stops iterating (client went away):
      // make sure the child doesn't outlive the request.
      if (proc.exitCode === null && proc.signalCode === null) proc.kill()
    }
  }

  async ping(): Promise<string> {
    return new Promise((resolve, reject) => {
      let out = ""
      // Windows resolves `claude` to a .cmd shim, which only launches through
      // a shell. That is safe here: the executable is allowlisted and the
      // argument list is a constant.
      const proc = spawn(this.cli, ["--version"], {
        shell: process.platform === "win32",
      })
      const timer = setTimeout(() => {
        proc.kill()
        reject(new Error("ping timed out"))
      }, PING_TIMEOUT_MS)
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

  async *stream(
    prompt: string,
    systemPrompt: string,
    model?: string,
    signal?: AbortSignal
  ): AsyncGenerator<RunnerEvent> {
    let res: Response
    try {
      res = await fetch(`${this.baseUrl}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, systemPrompt, ...(model ? { model } : {}) }),
        signal,
      })
    } catch (err) {
      if (signal?.aborted) return
      yield { type: "error", message: err instanceof Error ? err.message : "Runner unreachable" }
      return
    }

    if (!res.ok || !res.body) {
      yield { type: "error", message: `Runner responded ${res.status}` }
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    try {
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
            const parsed = JSON.parse(payload) as unknown
            if (typeof parsed === "string") {
              yield { type: "chunk", text: parsed }
            } else if (
              parsed &&
              typeof parsed === "object" &&
              typeof (parsed as { __error?: unknown }).__error === "string"
            ) {
              // The runner reports a failed CLI run as {__error} right before
              // [DONE]. Surface it instead of saving a truncated guide.
              yield { type: "error", message: (parsed as { __error: string }).__error }
              return
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (err) {
      if (signal?.aborted) return
      yield { type: "error", message: err instanceof Error ? err.message : "Runner stream failed" }
    } finally {
      // Closes the upstream connection, which lets the runner kill its CLI.
      reader.cancel().catch(() => {})
    }
  }

  async ping(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/ping`, {
      signal: AbortSignal.timeout(PING_TIMEOUT_MS),
    })
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
  // `||`, not `??`: the settings form saves untouched fields as empty strings,
  // which must fall through to the environment default like an unset value.
  const mode = config?.mode || process.env.AI_RUNNER || "local"
  if (mode === "remote") {
    const url = config?.url || process.env.AI_RUNNER_URL
    if (!url) throw new Error("AI_RUNNER_URL must be set when AI_RUNNER=remote")
    if (!isHttpUrl(url)) throw new Error("AI runner URL must be an http(s) URL")
    return new RemoteRunner(url.replace(/\/+$/, ""))
  }
  const cli = config?.cli || process.env.AI_CLI || "claude"
  if (!isAllowedCli(cli)) {
    throw new Error(`Unsupported AI CLI "${cli}" — allowed: ${ALLOWED_CLIS.join(", ")}`)
  }
  return new LocalRunner(cli)
}
