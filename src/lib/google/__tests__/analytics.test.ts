import { describe, it, expect, vi } from "vitest"

const mockRunReport = vi.fn(async (_opts: unknown) => ({
  data: {
    rows: [
      {
        dimensionValues: [{ value: "20250101" }],
        metricValues: [
          { value: "120" },
          { value: "100" },
          { value: "200" },
          { value: "0.45" },
          { value: "90" },
        ],
      },
    ],
    totals: [
      {
        dimensionValues: [{ value: "date" }],
        metricValues: [
          { value: "120" },
          { value: "100" },
          { value: "200" },
          { value: "0.45" },
          { value: "90" },
        ],
      },
    ],
  },
}))

vi.mock("googleapis", () => ({
  google: {
    analyticsdata: (_opts: unknown) => ({
      properties: {
        runReport: mockRunReport,
      },
    }),
    auth: {
      OAuth2: class {
        setCredentials(_creds: unknown) {}
      },
    },
  },
}))

describe("fetchGA4Report", () => {
  it("returns structured analytics report", async () => {
    const { fetchGA4Report } = await import("../analytics")
    const result = await fetchGA4Report(
      "properties/123",
      "fake-access-token",
      "2025-01-01",
      "2025-01-31"
    )
    expect(result.overview.sessions).toBe(120)
    expect(result.overview.users).toBe(100)
    expect(result.overview.pageviews).toBe(200)
    expect(result.daily).toBeInstanceOf(Array)
    expect(result.channels).toBeInstanceOf(Array)
    expect(result.topPages).toBeInstanceOf(Array)
  })
})
