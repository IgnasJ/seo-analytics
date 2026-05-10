// Minimal PageSpeed Insights API client. PSI runs Lighthouse against the URL
// in Google's cloud and returns the full Lighthouse JSON plus CrUX field data.
// API: https://developers.google.com/speed/docs/insights/v5/get-started

import { recordApiCall } from "@/lib/db/queries/api-usage"

const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
const REQUEST_TIMEOUT_MS = 90_000

const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"]

export interface RawPSIResponse {
  loadingExperience?: {
    metrics?: Record<string, RawCruxMetric>
  }
  lighthouseResult?: RawLighthouseResult
}

export interface RawCruxMetric {
  percentile?: number
  category?: string
  distributions?: Array<{ min?: number; max?: number; proportion?: number }>
}

export interface RawLighthouseResult {
  finalUrl?: string
  finalDisplayedUrl?: string
  requestedUrl?: string
  categories?: Record<
    string,
    {
      id?: string
      title?: string
      score?: number | null
      auditRefs?: Array<{ id: string; weight?: number; group?: string }>
    }
  >
  audits?: Record<
    string,
    {
      id?: string
      title?: string
      description?: string
      score?: number | null
      scoreDisplayMode?: string
      displayValue?: string
      numericValue?: number
      details?: {
        type?: string
        // Opportunity / diagnostic audits expose a quantified saving here.
        // Lighthouse fills only one of these depending on the audit kind.
        overallSavingsMs?: number
        overallSavingsBytes?: number
        // final-screenshot stores the PNG data URL on `data`.
        data?: string
      }
    }
  >
}

export async function fetchPSI(
  url: string,
  apiKey: string,
  strategy: "mobile" | "desktop" = "mobile"
): Promise<RawPSIResponse> {
  const params = new URLSearchParams()
  params.set("url", url)
  params.set("strategy", strategy)
  for (const c of CATEGORIES) params.append("category", c)
  if (apiKey) params.set("key", apiKey)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(`${PSI_ENDPOINT}?${params.toString()}`, {
      signal: controller.signal,
    })
    recordApiCall("psi")
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`PSI ${res.status}: ${text.slice(0, 300)}`)
    }
    return (await res.json()) as RawPSIResponse
  } finally {
    clearTimeout(timer)
  }
}
