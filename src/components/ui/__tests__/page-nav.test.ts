import { describe, it, expect } from "vitest"
import { computePageItems } from "../page-nav"

describe("computePageItems", () => {
  it("returns an empty-style sequence when there's just one page", () => {
    expect(computePageItems(1, 1)).toEqual([1])
  })

  it("shows every page when total is small (≤7)", () => {
    expect(computePageItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(computePageItems(1, 4)).toEqual([1, 2, 3, 4])
  })

  it("collapses a long range with leading ellipsis when current is far from page 1", () => {
    // pages 1, ..., 9, 10, 11, ..., 20 when current=10, total=20
    expect(computePageItems(10, 20)).toEqual([1, "...", 9, 10, 11, "...", 20])
  })

  it("avoids leading ellipsis when current is near the start", () => {
    expect(computePageItems(2, 20)).toEqual([1, 2, 3, "...", 20])
    expect(computePageItems(3, 20)).toEqual([1, 2, 3, 4, "...", 20])
  })

  it("avoids trailing ellipsis when current is near the end", () => {
    expect(computePageItems(19, 20)).toEqual([1, "...", 18, 19, 20])
    expect(computePageItems(18, 20)).toEqual([1, "...", 17, 18, 19, 20])
  })

  it("always starts with 1 and ends with totalPages for large ranges", () => {
    const items = computePageItems(10, 50)
    expect(items[0]).toBe(1)
    expect(items[items.length - 1]).toBe(50)
  })
})
