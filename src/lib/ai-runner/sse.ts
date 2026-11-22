/**
 * Server-sent-events response wrapper for the AI streaming routes.
 *
 * `produce` receives a `send` function and an AbortSignal. The signal fires as
 * soon as the browser goes away — either the request is aborted or the
 * response stream is cancelled — so the producer (and the CLI process behind
 * it) stops instead of running to completion for nobody.
 */
export type SseSend = (event: unknown) => void

export function sseResponse(
  requestSignal: AbortSignal,
  produce: (send: SseSend, signal: AbortSignal) => Promise<void>
): Response {
  const abort = new AbortController()
  const onRequestAbort = () => abort.abort()
  if (requestSignal.aborted) abort.abort()
  else requestSignal.addEventListener("abort", onRequestAbort, { once: true })

  const encoder = new TextEncoder()
  let closed = false

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send: SseSend = (event) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          // The consumer is gone; enqueue throws on a cancelled stream.
          closed = true
          abort.abort()
        }
      }

      try {
        await produce(send, abort.signal)
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : "unknown error",
        })
      } finally {
        requestSignal.removeEventListener("abort", onRequestAbort)
        if (!closed) {
          closed = true
          try {
            controller.close()
          } catch {
            /* already closed / errored */
          }
        }
      }
    },
    cancel() {
      closed = true
      abort.abort()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
