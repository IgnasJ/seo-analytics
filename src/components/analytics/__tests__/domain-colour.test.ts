import { describe, it, expect } from "vitest"
import { DOMAIN_PALETTE, domainColour } from "../domain-colour"

describe("domainColour", () => {
  it("ships a 12-colour palette", () => {
    expect(DOMAIN_PALETTE).toHaveLength(12)
  })

  it("maps id 0..11 to distinct colours", () => {
    const colours = new Set<string>()
    for (let i = 0; i < 12; i++) colours.add(domainColour(i))
    expect(colours.size).toBe(12)
  })

  it("is deterministic — same id always returns same colour", () => {
    expect(domainColour(7)).toBe(domainColour(7))
    expect(domainColour(42)).toBe(domainColour(42))
  })

  it("wraps around past 12 via modulo", () => {
    expect(domainColour(12)).toBe(domainColour(0))
    expect(domainColour(25)).toBe(domainColour(1))
  })

  it("handles negative ids by taking absolute value", () => {
    expect(domainColour(-1)).toBe(domainColour(1))
  })

  it("rounds non-integer ids", () => {
    expect(domainColour(3.7)).toBe(domainColour(3))
  })
})
