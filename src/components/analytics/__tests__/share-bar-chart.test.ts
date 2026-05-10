import { describe, it, expect } from "vitest"
import { capTopN, collectNames } from "../share-bar-chart"

describe("capTopN", () => {
  it("returns row unchanged when segments fit within the cap", () => {
    const row = {
      label: "a.com",
      segments: [
        { name: "Direct", value: 100 },
        { name: "Organic", value: 50 },
      ],
    }
    expect(capTopN(row, 5)).toEqual(row)
  })

  it("collapses surplus segments into a single 'Other' bucket", () => {
    const row = {
      label: "a.com",
      segments: [
        { name: "Direct", value: 100 },
        { name: "Organic", value: 80 },
        { name: "Referral", value: 50 },
        { name: "Social", value: 20 },
        { name: "Email", value: 10 },
        { name: "Paid", value: 5 },
      ],
    }
    const out = capTopN(row, 3)
    expect(out.segments).toHaveLength(4)
    expect(out.segments.slice(0, 3).map((s) => s.name)).toEqual([
      "Direct",
      "Organic",
      "Referral",
    ])
    expect(out.segments[3]).toEqual({ name: "Other", value: 35 })
  })

  it("does not append 'Other' when surplus values sum to zero", () => {
    const row = {
      label: "a.com",
      segments: [
        { name: "Direct", value: 100 },
        { name: "Organic", value: 50 },
        { name: "Empty1", value: 0 },
        { name: "Empty2", value: 0 },
      ],
    }
    const out = capTopN(row, 2)
    expect(out.segments).toHaveLength(2)
    expect(out.segments.find((s) => s.name === "Other")).toBeUndefined()
  })

  it("treats Infinity as 'no cap'", () => {
    const row = {
      label: "a.com",
      segments: Array.from({ length: 20 }, (_, i) => ({
        name: `s${i}`,
        value: i,
      })),
    }
    const out = capTopN(row, Number.POSITIVE_INFINITY)
    expect(out.segments).toHaveLength(20)
  })
})

describe("collectNames", () => {
  it("returns unique segment names in insertion order across rows", () => {
    const rows = [
      {
        label: "a",
        segments: [
          { name: "Direct", value: 1 },
          { name: "Organic", value: 1 },
        ],
      },
      {
        label: "b",
        segments: [
          { name: "Organic", value: 1 },
          { name: "Social", value: 1 },
        ],
      },
    ]
    expect(collectNames(rows)).toEqual(["Direct", "Organic", "Social"])
  })

  it("respects preferredOrder when supplied", () => {
    const rows = [
      {
        label: "a",
        segments: [
          { name: "tablet", value: 1 },
          { name: "mobile", value: 1 },
        ],
      },
    ]
    expect(collectNames(rows, ["desktop", "mobile", "tablet"])).toEqual([
      "desktop",
      "mobile",
      "tablet",
    ])
  })

  it("always pushes 'Other' to the end of the list", () => {
    const rows = [
      {
        label: "a",
        segments: [
          { name: "Direct", value: 1 },
          { name: "Other", value: 1 },
          { name: "Organic", value: 1 },
        ],
      },
    ]
    expect(collectNames(rows)).toEqual(["Direct", "Organic", "Other"])
  })
})
