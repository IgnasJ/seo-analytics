# SEO Analytics Dashboard

Personal dashboard for Google Analytics 4 and Google Search Console data, with a built-in on-page SEO audit tool. Single-user, self-hosted, Dockerized.

> **See it in action:** [DEMO.md](DEMO.md) — screenshots of every major page.
>
> **Quick start:** see [INSTALL.md](INSTALL.md) for the step-by-step setup (Google Cloud project → env vars → Docker → first sync).

## Features

- **Cross-domain Analytics page.** Side-by-side comparison view at `/analytics`: three multi-line trend charts (Sessions / Clicks / Impressions) with one coloured line per domain, a sortable leaderboard table, and three horizontal stacked-bar breakdowns (Channels / Countries / Devices). Same category chips and date range picker as the rest of the app — URL-bound state so views are shareable across reloads.
- **Grafana-style multi-domain dashboard.** Track an unlimited number of domains organised into user-defined categories. Dense card grid (4–5 cards per row on desktop) with inline sparklines for Sessions and Clicks, an inline trend chip for Avg Position, status dots and coloured left borders that surface unhealthy domains at a glance, and a top-right sync icon (hover for last-sync time, click to sync now). Toggle to **+ KPI** mode to overlay an aggregate strip across all domains: Total Sessions, Total Clicks, impression-weighted Avg Position, and "Healthy X of N" — all sparkline-able and persisted via localStorage.
- **GA4:** sessions, users, pageviews, bounce rate, channel breakdown, top pages.
- **GSC:** clicks, impressions, CTR, average position, daily trend chart, keyword position distribution.
- **Issues tab.** Core Web Vitals (LCP / CLS / INP) from CrUX field data + sitemap indexing health. Each metric is expandable into a diagnosis, common-causes list, and ranked fix list with high/medium/low impact tiers.
- **Opportunities tab.** "Quick-win keywords" — queries already ranking 4–20 with above-median impressions and below-average CTR. Click any keyword for a position-aware action checklist (different recommendations for page 1 vs page 2) and an estimated potential-clicks uplift if it reached top 3.
- **SEO Audit hub.** Paste any URL — yours or a competitor's — and get a Lighthouse-style audit (Performance / Accessibility / Best Practices / SEO scores, lab Core Web Vitals, ~80 individual checks) with a `[Mobile | Desktop]` strategy toggle. Audits run in the background and persist to SQLite. The audit page surfaces:
  - **Cross-URL summary card** rolling up the last 30 days into KPI tiles, worst-pages list, and common-failures list.
  - **History list** with URL-bound search / status / date filters, a `[By domain | By URL | Flat]` toggle (domain-grouped by default), and pagination.
  - **Per-URL detail page** at `/audit/url?u=…` — every audit ever run on one URL, four-line score trend chart + lab Core Web Vitals trend chart, audit pair selector for diff-any-two, and a screenshot strip showing how the page looked over time.
  - **Per-audit upgrades** — severity filter chips, failing entries sorted by Lighthouse's estimated savings (heaviest impact first), and inline "Potential 1.2 s / 84 KiB saved" pills.
  - **Domain integration** — every tracked domain has an Audits tab listing audits for that hostname with an "Audit top N pages" button that batches the top-clicked GSC URLs through PSI.
  - Supports paste-list batches up to 50 URLs.
- **Date ranges:** Today, Yesterday, 7 days, 1 month, 90 days, 1 year.
- **Data cached locally** in SQLite, synced on startup and on demand. Mobile-friendly responsive layout.

---

## Setup

See **[INSTALL.md](INSTALL.md)** — covers Google Cloud project setup, environment variables, Docker, OAuth, linking domains, running your first audit, deploying to a VPS, and troubleshooting.

---

## Project structure (high-level)

```
src/
  app/
    page.tsx                 # Dashboard — domain cards grouped by category
    domains/page.tsx         # Categories CRUD + domain CRUD + property linking
    audit/page.tsx           # SEO audit hub (paste URL, summary card, filterable history)
    audit/url/page.tsx       # Per-URL audit history with trend charts + pair compare
    domain/[id]/page.tsx     # Per-domain Analytics / Search Console / Issues / Opportunities / Audits tabs
    settings/page.tsx        # Google OAuth connect
    api/
      auth/                  # OAuth flow
      domains/               # Domain CRUD + discover + sync
      categories/            # Categories CRUD
      audit/                 # Audit POST/GET, batch, status
      data/                  # Cached analytics / GSC / issues for the dashboard
      sync/                  # Startup sync trigger
  lib/
    db/                      # SQLite driver, schema, migrations, queries
    google/                  # OAuth + GA4 + GSC + CrUX clients
    audit/                   # PSI client, transform, queue, runner
    seo/                     # opportunities, recommendations, issue-advice engines
    sync/                    # Startup + manual sync orchestration
    crypto.ts                # AES-GCM token encryption
  components/                # UI components (shadcn/ui + custom)
  types/                     # Shared TS types (analytics, search-console, audit, domain)
```

---

## Tech Stack

- **Runtime:** Node 20 (managed via pnpm + corepack)
- **Framework:** Next.js 16 (App Router, Turbopack)
- **Database:** SQLite via `better-sqlite3` (synchronous, native addon, embedded in the standalone build)
- **UI:** shadcn/ui + Tailwind CSS v4 + Recharts (line/bar charts) + custom SVG (Lighthouse gauges)
- **Audit:** Google PageSpeed Insights v5 API (Lighthouse mobile/desktop run with all 4 categories)
- **Field perf:** Chrome UX Report (CrUX) API
- **Analytics:** Google Analytics Data API v1
- **Search:** Google Search Console (Webmasters) API v3
- **Auth:** Google OAuth 2.0 with AES-GCM-encrypted refresh tokens at rest
- **Tests:** Vitest (Node environment), 160+ tests covering schema migrations, queries, GA4/PSI transformers, recommendation engines, queue serialization, audit aggregates

---

## Author

Built by [@IgnasJ](https://github.com/IgnasJ). Issues and PRs welcome.
