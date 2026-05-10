# SEO Analytics Dashboard

Personal dashboard for Google Analytics 4 and Google Search Console data, with a built-in on-page SEO audit tool. Single-user, self-hosted, Dockerized.

## Features

- **Grafana-style multi-domain dashboard.** Track an unlimited number of domains organised into user-defined categories. Dense card grid (4–5 cards per row on desktop) with inline sparklines for Sessions and Clicks, an inline trend chip for Avg Position, status dots and coloured left borders that surface unhealthy domains at a glance, and a top-right sync icon (hover for last-sync time, click to sync now). Toggle to **+ KPI** mode to overlay an aggregate strip across all domains: Total Sessions, Total Clicks, impression-weighted Avg Position, and "Healthy X of N" — all sparkline-able and persisted via localStorage.
- **GA4:** sessions, users, pageviews, bounce rate, channel breakdown, top pages.
- **GSC:** clicks, impressions, CTR, average position, daily trend chart, keyword position distribution.
- **Issues tab.** Core Web Vitals (LCP / CLS / INP) from CrUX field data + sitemap indexing health. Each metric is expandable into a diagnosis, common-causes list, and ranked fix list with high/medium/low impact tiers.
- **Opportunities tab.** "Quick-win keywords" — queries already ranking 4–20 with above-median impressions and below-average CTR. Click any keyword for a position-aware action checklist (different recommendations for page 1 vs page 2) and an estimated potential-clicks uplift if it reached top 3.
- **SEO Audit tool.** Paste any URL — yours or a competitor's — and get a Lighthouse-style audit (Performance / Accessibility / Best Practices / SEO scores, lab Core Web Vitals, ~80 individual checks). Audits run in the background and persist to SQLite. Re-auditing the same URL renders inline deltas. Supports paste-list batches up to 50 URLs.
- **Date ranges:** Today, Yesterday, 7 days, 1 month, 90 days, 1 year.
- **Data cached locally** in SQLite, synced on startup and on demand. Mobile-friendly responsive layout.

---

## Setup

### 1. Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a new project (e.g. `seo-dashboard`).
2. Enable these APIs (**APIs & Services → Library**):
   - **Google Analytics Data API**
   - **Google Analytics Admin API**
   - **Google Search Console API**
   - **Chrome UX Report API** (for field Core Web Vitals)
   - **PageSpeed Insights API** (for the audit tool — free, 25 000 queries/day)
3. Go to **APIs & Services → OAuth consent screen**:
   - User type: External
   - Fill in App name and support email
   - Add scopes: `analytics.readonly`, `webmasters.readonly`, `userinfo.email`
   - Add your email as a test user
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth Client ID**:
   - Application type: **Web application**
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback`
   - (Add your VPS URL too if deploying remotely, e.g. `https://your-server.com/api/auth/callback`)
   - Copy the **Client ID** and **Client Secret**
5. Create an **API Key** (Credentials → Create Credentials → API Key). Restrict it to the **Chrome UX Report API** *and* **PageSpeed Insights API** — both can share one key.

### 2. Environment Variables

```bash
cp .env.example .env
```

Fill in `.env`:

```
GOOGLE_CLIENT_ID=<your client ID>
GOOGLE_CLIENT_SECRET=<your client secret>
NEXT_PUBLIC_APP_URL=http://localhost:3000
ENCRYPTION_KEY=<run: openssl rand -hex 32>
CRUX_API_KEY=<your API key>
PSI_API_KEY=<your API key — same as CRUX_API_KEY is fine>
DB_PATH=/app/data/analytics.db
APP_USERNAME=admin
APP_PASSWORD=<set this for any non-localhost deployment>
```

> **Generate ENCRYPTION_KEY:** Run `openssl rand -hex 32` in your terminal and paste the output.
> **Re-using the API key:** if you restricted the key to both CrUX and PSI APIs, you can use the same value for `CRUX_API_KEY` and `PSI_API_KEY`.
> **App auth:** if `APP_PASSWORD` is empty or unset, the app runs with no login (convenient for `localhost`). Set both `APP_USERNAME` and `APP_PASSWORD` for any deployment beyond your machine. The session cookie is HMAC-signed with `ENCRYPTION_KEY`, so make sure that's set.

### 3. Run with Docker

```bash
docker compose up --build
```

Open `http://localhost:3000`.

### 4. Connect Google Account

1. Go to **Settings** → click **Connect / Re-authorize Google Account**.
2. Authorize all requested permissions (Analytics read, Search Console read, email).
3. You'll be redirected back to Settings.

### 5. Organise domains and link properties

1. Open **Domains** in the sidebar.
2. (Optional) Create categories — e.g. *Client*, *Personal*, *Test*. New domains land in *Uncategorized* by default; you can reassign with the per-row dropdown.
3. Enter `yourdomain.com` → click **Add**.
4. Click **Discover properties** — the app will list your GA4 and GSC accounts.
5. Click **Link** to connect them. The dashboard card will show an amber warning until both are linked.
6. Open the domain's detail page and click **Sync** to load the first data pull.

### 6. Run an audit (optional)

1. Open **Audit** in the sidebar.
2. Paste any URL (yours or a competitor's) → click **Audit**. Or expand "Audit a list of URLs" to paste up to 50 at once.
3. Audits run in the background — you can navigate away. Each completes in 15–30 s and shows up in the history list with the four Lighthouse score gauges plus collapsible category sections.
4. Re-audit the same URL later to see inline deltas.

---

## Development

The app runs under **Node 20+** with **pnpm** as the package manager.

```bash
pnpm install
pnpm dev
```

Run tests (Vitest under Node, no Bun required):

```bash
pnpm test          # one-shot
pnpm test:watch    # watch mode
```

Type-check / production build:

```bash
pnpm run build
```

---

## Deploy to VPS

1. Copy this repo to your VPS (e.g. via `git clone` or `scp`).
2. Update `.env`: set `NEXT_PUBLIC_APP_URL` to your domain or IP (e.g. `https://seo.yourdomain.com`).
3. Add the VPS callback URL to Google Cloud Console → Credentials → your OAuth client → Authorized redirect URIs.
4. Run `docker compose up -d --build`.

> **Security:** set `APP_USERNAME` and `APP_PASSWORD` in `.env` before exposing the app to the public internet. With auth enabled, every page and API route requires a signed session cookie (30-day expiry, HMAC-signed with `ENCRYPTION_KEY`); unauthenticated requests get redirected to `/login` (pages) or 401 (API). Auth is opt-in — leaving `APP_PASSWORD` blank disables it for local dev. For an extra defence-in-depth layer in front, a reverse proxy with Cloudflare Access, Tailscale, or basic-auth is still a good idea.

---

## Project structure (high-level)

```
src/
  app/
    page.tsx                 # Dashboard — domain cards grouped by category
    domains/page.tsx         # Categories CRUD + domain CRUD + property linking
    audit/page.tsx           # SEO audit tool (paste URL, history, diffs)
    domain/[id]/page.tsx     # Per-domain Analytics / Search Console / Issues / Opportunities tabs
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
- **Audit:** Google PageSpeed Insights v5 API (Lighthouse mobile run with all 4 categories)
- **Field perf:** Chrome UX Report (CrUX) API
- **Analytics:** Google Analytics Data API v1
- **Search:** Google Search Console (Webmasters) API v3
- **Auth:** Google OAuth 2.0 with AES-GCM-encrypted refresh tokens at rest
- **Tests:** Vitest (Node environment), 60+ tests covering schema migrations, queries, GA4/PSI transformers, recommendation engines, queue serialization
