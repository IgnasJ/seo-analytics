import type { CwvMetric, SitemapInfo } from "@/types/search-console"

export type Severity = "ok" | "warn" | "critical" | "info"

export interface Fix {
  title: string
  detail: string
  /** Relative impact on the metric. High = biggest expected improvement. */
  impact: "high" | "medium" | "low"
}

export interface IssueInsight {
  severity: Severity
  /** Plain-English summary of the current state. */
  diagnosis: string
  /** Common root causes contributing to this metric being poor. */
  causes: string[]
  /** Ordered fixes, highest-impact first. */
  fixes: Fix[]
}

/**
 * Map a Core Web Vitals "good %" to the canonical pass/fail bands. The
 * official CrUX pass threshold is 75% of users hitting the "good" bucket;
 * anything between 50–75 is a warning, below 50 is critical. A null metric
 * means CrUX hasn't accumulated enough real-user data (typically need ~28
 * days of meaningful traffic).
 */
function severityFromGoodPct(metric: CwvMetric | null): Severity {
  if (!metric) return "info"
  if (metric.good >= 75) return "ok"
  if (metric.good >= 50) return "warn"
  return "critical"
}

const NO_DATA_INSIGHT: Omit<IssueInsight, "diagnosis"> = {
  severity: "info",
  causes: [
    "CrUX (Chrome User Experience Report) needs ~28 days of real-user Chrome traffic before reporting a metric.",
    "Low-traffic sites may never see field data — try lab metrics from PageSpeed Insights instead.",
  ],
  fixes: [
    {
      title: "Run a lab audit via /audit",
      detail:
        "The Audit tab runs PageSpeed Insights against any URL and gives you lab Core Web Vitals plus a full Lighthouse report — no traffic threshold required.",
      impact: "high",
    },
    {
      title: "Verify Chrome users can reach the site",
      detail:
        "Check that the site is publicly accessible, not behind a VPN, login, or geofence. CrUX only counts opted-in Chrome telemetry.",
      impact: "low",
    },
  ],
}

export function assessLcp(metric: CwvMetric | null): IssueInsight {
  if (!metric) {
    return {
      ...NO_DATA_INSIGHT,
      diagnosis:
        "No field LCP data yet — CrUX hasn't accumulated enough Chrome traffic for this site.",
    }
  }
  const sev = severityFromGoodPct(metric)
  const diagnosis =
    sev === "ok"
      ? `LCP is healthy: ${metric.good}% of page loads paint the main content within 2.5 s.`
      : sev === "warn"
        ? `LCP needs attention: only ${metric.good}% of users see fast main-content paint, with ${metric.poor}% experiencing slow loads (>4 s).`
        : `LCP is failing CrUX thresholds: ${metric.poor}% of users see the main content take longer than 4 s — this directly hurts rankings.`

  return {
    severity: sev,
    diagnosis,
    causes: [
      "Hero/above-the-fold image is large or unoptimized (most common cause)",
      "Slow server response time (TTFB) — uncached pages, distant hosting, blocking middleware",
      "Render-blocking JavaScript or CSS in the <head>",
      "Web fonts loading from third-party origins (extra DNS + handshake)",
      "Layout requires waiting for late-loading data (e.g. client-rendered hero)",
    ],
    fixes: [
      {
        title: "Compress and modernize the hero image",
        detail:
          "Convert above-the-fold images to WebP or AVIF, target <100 KB, set explicit width/height, add loading=\"eager\" + fetchpriority=\"high\". This single change typically moves LCP by 30–60%.",
        impact: "high",
      },
      {
        title: "Preload the LCP image",
        detail:
          "Add <link rel=\"preload\" as=\"image\" href=\"/hero.webp\" fetchpriority=\"high\"> in <head>. Tells the browser to fetch the LCP candidate before HTML parsing finishes.",
        impact: "high",
      },
      {
        title: "Reduce TTFB",
        detail:
          "Cache HTML at the edge (Cloudflare, Vercel, etc.), enable HTTP/3, move hosting closer to your audience. Aim for TTFB under 600 ms.",
        impact: "high",
      },
      {
        title: "Inline critical CSS, defer the rest",
        detail:
          "Extract the CSS needed for above-the-fold content and inline it; load the remaining stylesheet with media=\"print\" + onload swap or via async fetch.",
        impact: "medium",
      },
      {
        title: "Self-host or preconnect web fonts",
        detail:
          "Add <link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>. Better: self-host the WOFF2 file and skip the third-party hop entirely. Use font-display: swap to avoid invisible text.",
        impact: "medium",
      },
      {
        title: "Avoid client-side rendering for the hero",
        detail:
          "If your LCP element is rendered by JS after fetch, switch to SSR / static-generated HTML for at least that section. Client-rendered LCPs almost always fail mobile thresholds.",
        impact: "high",
      },
    ],
  }
}

export function assessCls(metric: CwvMetric | null): IssueInsight {
  if (!metric) {
    return {
      ...NO_DATA_INSIGHT,
      diagnosis:
        "No field CLS data yet — CrUX hasn't accumulated enough Chrome traffic for this site.",
    }
  }
  const sev = severityFromGoodPct(metric)
  const diagnosis =
    sev === "ok"
      ? `CLS is stable: ${metric.good}% of page loads have no significant layout shift.`
      : sev === "warn"
        ? `CLS is borderline: ${metric.good}% stable, ${metric.needsImprovement + metric.poor}% of users experience visible jumps as the page loads.`
        : `CLS is failing: ${metric.poor}% of users see major layout shifts (CLS > 0.25). Likely caused by missing image dimensions, late-injected content, or font swaps.`

  return {
    severity: sev,
    diagnosis,
    causes: [
      "Images without width/height attributes — browser reflows when they finally load",
      "Ads, iframes, or embeds inserted into the page after initial render",
      "Web fonts with mismatched fallback metrics — text reflows when the real font swaps in (FOUT)",
      "Dynamic banners, cookie notices, or app shells injected at the top",
      "CSS animations changing properties that trigger layout (top, left, height)",
    ],
    fixes: [
      {
        title: "Set width and height on every <img> and <video>",
        detail:
          "Even with responsive CSS (max-width:100%; height:auto), the width/height attributes give the browser an aspect ratio to reserve space. This eliminates the most common CLS source.",
        impact: "high",
      },
      {
        title: "Reserve space for ads / embeds",
        detail:
          "Wrap each ad slot in a container with explicit min-height set to the largest expected ad size. The space stays held even if the ad arrives late.",
        impact: "high",
      },
      {
        title: "Match fallback font metrics",
        detail:
          "Use size-adjust, ascent-override, descent-override, line-gap-override on @font-face to make the fallback font occupy the same vertical space as the web font. Eliminates layout shifts on font swap.",
        impact: "medium",
      },
      {
        title: "Avoid inserting content above existing content",
        detail:
          "Cookie banners, announcement bars, and notifications should overlay (position: fixed) rather than push content down. If they must take layout space, render them server-side so they're already there on first paint.",
        impact: "medium",
      },
      {
        title: "Animate only transform and opacity",
        detail:
          "These properties don't trigger layout. Avoid animating top/left/height/width — they cause CLS even on small movements.",
        impact: "low",
      },
    ],
  }
}

export function assessInp(metric: CwvMetric | null): IssueInsight {
  if (!metric) {
    return {
      ...NO_DATA_INSIGHT,
      diagnosis:
        "No field INP data yet — CrUX hasn't accumulated enough Chrome traffic for this site.",
    }
  }
  const sev = severityFromGoodPct(metric)
  const diagnosis =
    sev === "ok"
      ? `INP is responsive: ${metric.good}% of interactions paint within 200 ms.`
      : sev === "warn"
        ? `INP is sluggish: ${metric.poor}% of interactions take >500 ms to respond — users perceive this as the page being broken.`
        : `INP is failing: ${metric.poor}% of taps and clicks have a >500 ms response time. Most often caused by long-running JavaScript on the main thread.`

  return {
    severity: sev,
    diagnosis,
    causes: [
      "Heavy JavaScript executing on click/tap/scroll handlers",
      "Large React component trees re-rendering on every state change",
      "Third-party scripts (ads, analytics, chat widgets) blocking the main thread",
      "Synchronous IndexedDB or localStorage access in event handlers",
      "Untargeted re-renders due to context changes or non-memoized callbacks",
    ],
    fixes: [
      {
        title: "Audit third-party scripts",
        detail:
          "Open Chrome DevTools → Performance → record an interaction. Look for Long Tasks. Often a single ad SDK or chat widget is responsible for 60–80% of main-thread blocking. Defer with async, lazy-load on user gesture, or remove.",
        impact: "high",
      },
      {
        title: "Break up long-running event handlers",
        detail:
          "Split work into chunks with await new Promise(r => setTimeout(r, 0)) between sections, or use scheduler.yield() in modern Chrome. The browser can paint between chunks.",
        impact: "high",
      },
      {
        title: "Code-split JavaScript bundles",
        detail:
          "Use dynamic imports for routes and heavy components. Reduces initial parse/compile cost. In Next.js: import dynamic from \"next/dynamic\" with ssr: false for client-only widgets.",
        impact: "high",
      },
      {
        title: "Memoize React work",
        detail:
          "useMemo for expensive computations, useCallback for handlers passed to child components. Wrap leaf components in React.memo. Reduces wasted re-renders that can blow up INP.",
        impact: "medium",
      },
      {
        title: "Use passive event listeners",
        detail:
          "addEventListener('touchstart', handler, { passive: true }) tells the browser the handler won't preventDefault, allowing immediate scroll. Especially helps mobile INP.",
        impact: "medium",
      },
      {
        title: "Throttle/debounce high-frequency events",
        detail:
          "Wrap scroll, resize, mousemove, and onChange (for text inputs) handlers in throttle (16ms) or debounce (250ms). Prevents 60 calls/sec from saturating the main thread.",
        impact: "low",
      },
    ],
  }
}

export interface SitemapInsight extends IssueInsight {
  /** Quick metric for the row header. */
  coverageRatio: number  // 0..1, indexed/submitted (1 if submitted=0)
}

export function assessSitemap(s: SitemapInfo): SitemapInsight {
  const ratio = s.submitted > 0 ? s.indexed / s.submitted : 1
  const causes: string[] = []
  const fixes: Fix[] = []
  let severity: Severity = "ok"
  let diagnosis = `Sitemap is healthy. ${s.indexed}/${s.submitted} URLs indexed.`

  if (s.errors > 0) {
    severity = "critical"
    diagnosis = `Sitemap has ${s.errors} error(s). Google can't process some or all URLs.`
    causes.push(
      "Invalid XML structure (unclosed tags, wrong namespace)",
      "Broken or 404 URLs listed in the sitemap",
      "URLs blocked by robots.txt",
      "URLs with non-canonical redirects"
    )
    fixes.push(
      {
        title: "Open Search Console → Sitemaps → click this sitemap",
        detail:
          "Google lists the specific URLs and reasons. Fix or remove those URLs from the sitemap.",
        impact: "high",
      },
      {
        title: "Validate the sitemap XML",
        detail:
          "Run the sitemap URL through https://www.xml-sitemaps.com/validate-xml-sitemap.html. Common issues: BOM bytes, wrong protocol declaration, encoded ampersands.",
        impact: "high",
      },
      {
        title: "Re-submit after fixing",
        detail:
          "Once URLs are corrected, click 'Submit' on the sitemap row in Search Console to trigger a fresh crawl.",
        impact: "medium",
      }
    )
  } else if (s.warnings > 0) {
    severity = "warn"
    diagnosis = `Sitemap has ${s.warnings} warning(s). Indexable but Google flagged minor issues.`
    causes.push(
      "Some URLs return non-200 status codes but are not hard errors",
      "Sitemap-listed URLs are excluded by canonical or noindex tags",
      "Encoding inconsistencies (mixed http/https, trailing slashes)"
    )
    fixes.push({
      title: "Review warnings in Search Console",
      detail:
        "Open the sitemap detail in GSC. Warnings don't block indexing but reduce trust over time. Fix as time permits.",
      impact: "medium",
    })
  }

  if (s.submitted > 0 && ratio < 0.7) {
    if (severity === "ok") severity = "warn"
    const pct = Math.round(ratio * 100)
    diagnosis = `Indexing gap: only ${s.indexed}/${s.submitted} URLs indexed (${pct}%). ${diagnosis === `Sitemap is healthy. ${s.indexed}/${s.submitted} URLs indexed.` ? "" : diagnosis}`
    causes.push(
      "Pages blocked by robots.txt or robots meta tag (noindex)",
      "Canonical tags pointing to a different URL",
      "Thin or duplicate content Google chose not to index",
      "Soft 404s (200 OK status but page says 'not found')",
      "Server returned 5xx during Google's crawl attempt"
    )
    fixes.push(
      {
        title: "Use Search Console → Pages report",
        detail:
          "Filter by 'Crawled - currently not indexed' and 'Discovered - currently not indexed'. Each bucket has a specific fix path. Sample 5–10 URLs and check why.",
        impact: "high",
      },
      {
        title: "Inspect individual URLs",
        detail:
          "Use the URL Inspection tool on a non-indexed sample. Common findings: noindex tag, canonical points elsewhere, blocked by robots.txt, page quality below threshold.",
        impact: "high",
      },
      {
        title: "Improve content depth on thin pages",
        detail:
          "Pages under 300 words with little unique content frequently fail to index. Either expand them, consolidate into a parent page, or remove from the sitemap.",
        impact: "medium",
      }
    )
  }

  if (s.submitted === 0 && s.indexed === 0) {
    severity = "info"
    diagnosis = "This sitemap is registered but contains no submitted URLs."
    causes.push(
      "Sitemap file is empty or returns an empty <urlset>",
      "Sitemap is a sitemap index pointing to other sitemaps that may be empty"
    )
    fixes.push({
      title: "Verify the sitemap content",
      detail:
        "Open the sitemap URL directly in a browser. It should contain <url><loc>https://...</loc></url> entries. If empty, regenerate via your CMS or sitemap plugin.",
      impact: "high",
    })
  }

  return { severity, diagnosis, causes, fixes, coverageRatio: ratio }
}

/**
 * No sitemaps registered at all - separate insight for that empty state.
 */
export const NO_SITEMAPS_INSIGHT: IssueInsight = {
  severity: "warn",
  diagnosis:
    "No sitemaps are registered with Search Console for this property. Google will discover pages through links, but submitting a sitemap accelerates indexing and gives you an indexing report.",
  causes: [
    "Sitemap was never submitted",
    "Sitemap was removed and not re-added",
    "Site is too new to have generated a sitemap yet",
  ],
  fixes: [
    {
      title: "Generate a sitemap",
      detail:
        "Most CMSs auto-generate one (WordPress: Yoast or RankMath plugin; Next.js: app/sitemap.ts; static sites: next-sitemap or a build-time generator). Confirm it's served at /sitemap.xml.",
      impact: "high",
    },
    {
      title: "Submit it in Search Console",
      detail:
        "Search Console → Sitemaps → enter the path (e.g. sitemap.xml) → Submit. Google will start indexing the listed URLs within hours.",
      impact: "high",
    },
    {
      title: "Reference it in robots.txt",
      detail:
        "Add a Sitemap: https://yoursite.com/sitemap.xml line to your robots.txt file. Helps other search engines (Bing, DuckDuckGo) discover it.",
      impact: "low",
    },
  ],
}
