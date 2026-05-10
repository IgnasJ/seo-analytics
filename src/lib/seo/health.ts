// Card-level severity classification for the dashboard. Pure functions, no
// I/O — feed them the precomputed signals from the page layer and they
// return the visual severity ("green" / "amber" / "red") plus a list of
// human-readable reasons for the tooltip.

export type Severity = "green" | "amber" | "red"

export interface CardSignals {
  ga4Linked: boolean
  gscLinked: boolean
  /** Unix seconds; null when no sync has ever run for this domain. */
  lastSyncedAt: number | null
  /** Status of the most recent sync_log row for this domain. */
  lastSyncStatus: "success" | "error" | null
  /** Aggregate count of CWV-poor + sitemap-error issues. */
  issueCount: number
}

export interface CardHealth {
  severity: Severity
  reasons: string[]
}

const ONE_DAY_SECS = 24 * 60 * 60
const TWO_DAYS_SECS = 48 * 60 * 60

/**
 * Compute a card's severity and the list of contributing reasons.
 *
 * Severity is the highest level among all triggered signals — a single red
 * signal makes the card red even if everything else is green. The reasons
 * array is ordered loosely from worst to least-bad so tooltips read top-down.
 */
export function cardHealth(signals: CardSignals): CardHealth {
  const reasons: string[] = []
  let severity: Severity = "green"

  function bump(level: Severity) {
    if (level === "red") severity = "red"
    else if (level === "amber" && severity !== "red") severity = "amber"
  }

  // Red signals first.
  if (signals.lastSyncStatus === "error") {
    bump("red")
    reasons.push("Most recent sync failed")
  }

  const now = Math.floor(Date.now() / 1000)
  if (signals.lastSyncedAt !== null) {
    const ageSecs = now - signals.lastSyncedAt
    if (ageSecs > TWO_DAYS_SECS) {
      bump("red")
      reasons.push(`Last sync was ${Math.round(ageSecs / ONE_DAY_SECS)} days ago`)
    } else if (ageSecs > ONE_DAY_SECS) {
      bump("amber")
      reasons.push(`Last sync was ${Math.round(ageSecs / 3600)} hours ago`)
    }
  } else {
    bump("amber")
    reasons.push("Never synced")
  }

  if (signals.issueCount > 0) {
    bump("red")
    reasons.push(
      signals.issueCount === 1
        ? "1 active issue (CWV / sitemap)"
        : `${signals.issueCount} active issues (CWV / sitemap)`
    )
  }

  // Amber signals.
  if (!signals.ga4Linked) {
    bump("amber")
    reasons.push("Google Analytics property not linked")
  }
  if (!signals.gscLinked) {
    bump("amber")
    reasons.push("Search Console property not linked")
  }

  if (severity === "green" && reasons.length === 0) {
    reasons.push("All systems healthy")
  }

  return { severity, reasons }
}

/**
 * Count domains by severity bucket. Used by the KPI strip's
 * "Healthy X of N" tile.
 */
export function healthCounts(severities: Severity[]): {
  total: number
  green: number
  amber: number
  red: number
} {
  let green = 0,
    amber = 0,
    red = 0
  for (const s of severities) {
    if (s === "green") green++
    else if (s === "amber") amber++
    else red++
  }
  return { total: severities.length, green, amber, red }
}
