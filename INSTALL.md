# Installation

Step-by-step setup for the [SEO Analytics Dashboard](README.md). About 15 minutes the first time — most of it is in the Google Cloud Console.

## Prerequisites

- **Docker** (for the recommended Docker path) or **Node 20+ with pnpm** (for the manual / dev path)
- A Google account with read access to the GA4 properties and Search Console sites you want to track
- The ability to create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/)

---

## 1. Google Cloud Project

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

---

## 2. Environment Variables

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
>
> **Re-using the API key:** if you restricted the key to both CrUX and PSI APIs, you can use the same value for `CRUX_API_KEY` and `PSI_API_KEY`.
>
> **App auth:** if `APP_PASSWORD` is empty or unset, the app runs with no login (convenient for `localhost`). Set both `APP_USERNAME` and `APP_PASSWORD` for any deployment beyond your machine. The session cookie is HMAC-signed with `ENCRYPTION_KEY`, so make sure that's set.

---

## 3. Run with Docker

```bash
docker compose up --build
```

Open `http://localhost:3000`.

The container persists data to `./data/` on the host via a bind mount, so audits, OAuth tokens, and cached GA4/GSC payloads survive restarts.

---

## 4. Connect Google Account

1. Go to **Settings** → click **Connect / Re-authorize Google Account**.
2. Authorize all requested permissions (Analytics read, Search Console read, email).
3. You'll be redirected back to Settings.

---

## 5. Organise domains and link properties

1. Open **Domains** in the sidebar.
2. (Optional) Create categories — e.g. *Client*, *Personal*, *Test*. New domains land in *Uncategorized* by default; you can reassign with the per-row dropdown.
3. Enter `yourdomain.com` → click **Add**.
4. Click **Discover properties** — the app will list your GA4 and GSC accounts.
5. Click **Link** to connect them. The dashboard card will show an amber warning until both are linked.
6. Open the domain's detail page and click **Sync** to load the first data pull.

---

## 6. Run an audit (optional)

1. Open **Audit** in the sidebar.
2. Pick **Mobile** or **Desktop** (mobile by default — preference persists in localStorage).
3. Paste any URL (yours or a competitor's) → click **Audit**. Or expand "Audit a list of URLs" to paste up to 50 at once.
4. Audits run in the background — you can navigate away. Each completes in 15–30 s and shows up in the history list with the four Lighthouse score gauges plus collapsible category sections.
5. Click the external-link icon on any history row (or any URL in the summary card / grouped view) to land on `/audit/url?u=…`, which shows the full trend history for that URL plus a side-by-side comparison of any two audits.
6. On a tracked domain's page, open the **Audits** tab and click **Audit top N pages** to batch-audit the most-clicked GSC URLs in one go.

---

## Development (without Docker)

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

## Troubleshooting

- **"GSC not linked" warning won't go away after Sync.** Make sure the Google account you OAuth'd with has at least read access to the property in Search Console. Owner / verified-owner is best.
- **GA4 overview shows zeros.** Confirm the GA4 property ID linked in **Domains** matches a property that has data in the selected date range.
- **`docker compose up --build` fails on first run.** Ensure Docker Desktop has at least 2 GB of RAM allocated. The Next.js build is the heaviest step.
- **OAuth callback errors.** The redirect URI in Google Cloud Console must match `NEXT_PUBLIC_APP_URL + /api/auth/callback` byte-for-byte — `http` vs `https` and trailing slashes both matter.

---

← Back to [README](README.md)
