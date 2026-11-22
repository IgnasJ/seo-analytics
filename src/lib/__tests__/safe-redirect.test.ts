import { describe, it, expect } from "vitest"
import { safeNextPath } from "../safe-redirect"

describe("safeNextPath", () => {
  it("keeps same-origin paths, including query and hash", () => {
    expect(safeNextPath("/")).toBe("/")
    expect(safeNextPath("/audit")).toBe("/audit")
    expect(safeNextPath("/audit/url?u=https%3A%2F%2Fx.com%2F&tab=mobile#top")).toBe(
      "/audit/url?u=https%3A%2F%2Fx.com%2F&tab=mobile#top"
    )
  })

  it("falls back for missing values", () => {
    expect(safeNextPath(null)).toBe("/")
    expect(safeNextPath(undefined)).toBe("/")
    expect(safeNextPath("")).toBe("/")
  })

  it("rejects script and absolute URLs", () => {
    expect(safeNextPath("javascript:alert(1)")).toBe("/")
    expect(safeNextPath("https://evil.example/")).toBe("/")
    expect(safeNextPath("data:text/html,<script>1</script>")).toBe("/")
  })

  it("rejects protocol-relative and backslash variants", () => {
    expect(safeNextPath("//evil.example/x")).toBe("/")
    expect(safeNextPath("/\\evil.example/x")).toBe("/")
    expect(safeNextPath("/\t/evil.example")).toBe("/")
  })

  it("honours a custom fallback", () => {
    expect(safeNextPath("https://evil.example", "/home")).toBe("/home")
  })
})
