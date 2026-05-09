# SEO Analytics Dashboard

Personal dashboard for Google Analytics 4 and Google Search Console data. Single-user, self-hosted, Dockerized.

## Features

- Track multiple domains in one place
- GA4: sessions, users, pageviews, bounce rate, channel breakdown, top pages
- GSC: clicks, impressions, CTR, average position, keyword position distribution
- Issues: Core Web Vitals (CrUX), sitemap errors and warnings
- SEO Opportunities: quick-win keywords (ranking 4–20, high impressions, low CTR)
- Date ranges: Today, Yesterday, 7 days, 1 month, 90 days, 1 year
- Data cached locally in SQLite, synced on startup and on demand

---

## Setup

### 1. Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a new project (e.g. `seo-dashboard`)
2. Enable these APIs (**APIs & Services → Library**):
   - **Google Analytics Data API**
   - **Google Analytics Admin API**
   - **Google Search Console API**
   - **Chrome UX Report API**
3. Go to **APIs & Services → OAuth consent screen**:
   - User type: External
   - Fill in App name, support email
   - Add scopes: `analytics.readonly`, `webmasters.readonly`, `userinfo.email`
   - Add your email as a test user
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth Client ID**:
   - Application type: **Web application**
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback`
   - (Add your VPS URL too if deploying remotely, e.g. `https://your-server.com/api/auth/callback`)
   - Copy the **Client ID** and **Client Secret**
5. Create an **API Key** (for CrUX):
   - Credentials → Create Credentials → API Key
   - Restrict it to the **Chrome UX Report API**

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
DB_PATH=/app/data/analytics.db
```

> **Generate ENCRYPTION_KEY:** Run `openssl rand -hex 32` in your terminal and paste the output.

### 3. Run with Docker

```bash
docker compose up --build
```

Open `http://localhost:3000`

### 4. Connect Google Account

1. Go to **Settings** → click **Connect / Re-authorize Google Account**
2. Authorize all requested permissions (Analytics read, Search Console read, email)
3. You'll be redirected back to Settings

### 5. Add a Domain

1. Settings → enter `yourdomain.com` → click **Add**
2. Click **Discover properties** — the app will find your GA4 and GSC accounts
3. Click **Link** to connect them
4. Click **Sync** on the domain detail page to load the first data pull

---

## Development

```bash
bun install
bun run dev
```

Run tests:
```bash
bun test
```

---

## Deploy to VPS

1. Copy this repo to your VPS (e.g. via git clone or scp)
2. Update `.env`: set `NEXT_PUBLIC_APP_URL` to your domain or IP (e.g. `https://seo.yourdomain.com`)
3. Add the VPS callback URL to Google Cloud Console → Credentials → your OAuth client → Authorized redirect URIs
4. Run `docker compose up -d --build`

---

## Tech Stack

- **Runtime:** Bun
- **Framework:** Next.js 15 (App Router)
- **Database:** SQLite via bun:sqlite (built-in)
- **UI:** shadcn/ui + Tailwind CSS + Recharts
- **APIs:** Google Analytics Data API, Google Search Console API, Chrome UX Report API
- **Auth:** Google OAuth 2.0 with encrypted refresh token storage
