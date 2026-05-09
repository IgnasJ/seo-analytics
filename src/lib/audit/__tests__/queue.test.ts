import { describe, it, expect } from "vitest"
import { enqueue, _flushForTest } from "../queue"

describe("audit queue", () => {
  it("serialises enqueued jobs (no overlap)", async () => {
    const order: string[] = []
    const job = (label: string, ms: number) => async () => {
      order.push(`start ${label}`)
      await new Promise((r) => setTimeout(r, ms))
      order.push(`end ${label}`)
    }
    enqueue(job("a", 30))
    enqueue(job("b", 10))
    enqueue(job("c", 20))
    await _flushForTest()
    expect(order).toEqual([
      "start a",
      "end a",
      "start b",
      "end b",
      "start c",
      "end c",
    ])
  })

  it("continues after a failing job", async () => {
    const order: string[] = []
    enqueue(async () => {
      order.push("a")
    })
    enqueue(async () => {
      order.push("boom")
      throw new Error("oh no")
    })
    enqueue(async () => {
      order.push("c")
    })
    await _flushForTest()
    expect(order).toEqual(["a", "boom", "c"])
  })
})
