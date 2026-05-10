import type { OpportunityRow } from "./opportunities"

/**
 * Approximate industry-average CTR by Google SERP position. Sourced from
 * aggregated CTR studies (Advanced Web Ranking, Sistrix, Backlinko 2023);
 * exact numbers vary by SERP feature presence (featured snippets, AI overview,
 * shopping carousels, etc.) but the curve shape is consistent.
 *
 * We use these numbers only to estimate *order-of-magnitude* uplift, not to
 * make precise predictions.
 */
export function expectedCtrAt(position: number): number {
  if (position <= 1) return 0.3
  if (position <= 2) return 0.18
  if (position <= 3) return 0.12
  if (position <= 10) {
    // Linear decline 4..10 from 7% to 2.5%.
    return 0.07 - ((position - 3) / 7) * (0.07 - 0.025)
  }
  if (position <= 20) {
    // Linear decline 11..20 from 1.5% to 0.5%.
    return 0.015 - ((position - 10) / 10) * (0.015 - 0.005)
  }
  return 0.005
}

export interface Recommendation {
  diagnosis: string
  /**
   * Estimated additional monthly clicks if the keyword reaches top-3.
   * Floored at 0; uses current impression volume × delta in expected CTR.
   * Treats the row's `impressions` field as a 30-day window (consistent
   * with how the dashboard aggregates GSC data).
   */
  potentialClicks: number
  /**
   * Ordered, position-aware action checklist. Most impactful first.
   */
  actions: string[]
}

export function recommendationFor(row: OpportunityRow): Recommendation {
  const onPageOne = row.position <= 10
  const expectedAtTop3 = expectedCtrAt(3)
  const expectedAtCurrent = expectedCtrAt(row.position)
  const ctrUplift = Math.max(0, expectedAtTop3 - expectedAtCurrent)
  const potentialClicks = Math.round(row.impressions * ctrUplift)

  const actions: string[] = []
  let diagnosis: string

  if (onPageOne) {
    diagnosis = `Already on page 1 at position #${row.position.toFixed(
      1
    )}. The biggest quick win usually comes from on-page tweaks rather than new backlinks — Google already considers this page relevant.`
    actions.push(
      "Refresh and expand the page content — add 200–500 more words covering related sub-topics, FAQs, comparisons, or examples"
    )
    actions.push(
      "Make sure the exact target query (or a very close variant) appears verbatim in the H1 and meta title"
    )
    actions.push(
      "Add internal links from 3–5 of your highest-traffic pages to this URL, using the target query as anchor text"
    )
    actions.push(
      "Check for keyword cannibalization — search your own site for this query and consolidate competing pages if any"
    )
    if (row.ctr < 0.02) {
      actions.push(
        "Rewrite the meta title and description for click-appeal — your CTR is below the page-1 average for this position"
      )
    }
  } else {
    diagnosis = `Page 2 territory at position #${row.position.toFixed(
      1
    )}. Page 2 gets roughly 10× fewer clicks than page 1, even with great content — pushing into the top 10 is the main goal here.`
    actions.push(
      "Boost topical depth with supporting cluster content — write 2–3 related articles linking back to this URL"
    )
    actions.push(
      "Acquire 1–3 quality backlinks pointing to this exact URL — guest posts, digital PR, or unlinked-mention outreach"
    )
    actions.push(
      "Audit on-page basics: target query in H1 and title, descriptive image alt text, fast LCP, no thin sections"
    )
    actions.push(
      "Update the publish/modified date and modernize the content — Google rewards freshness for many query types"
    )
    actions.push(
      "Compare your page to the top-3 ranking results — what content sections do they have that you don't?"
    )
  }

  if (row.ctr < 0.01) {
    actions.push(
      "Your CTR is unusually low even for this position — the SERP snippet may not match what searchers expect. Rewrite the title and description to mirror searcher intent."
    )
  }

  return { diagnosis, potentialClicks, actions }
}
