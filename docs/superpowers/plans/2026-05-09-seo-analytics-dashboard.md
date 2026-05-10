# SEO Analytics Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal single-user SEO analytics dashboard that aggregates Google Analytics 4 and Google Search Console data for multiple domains, with automatic data discovery, caching, and actionable SEO insights.

**Architecture:** Next.js 15 App Router monorepo running on Bun runtime. `bun:sqlite` stores encrypted OAuth refresh tokens and cached API responses locally. Google APIs (GA4 Data API, GSC Search Analytics API, CrUX API) are queried at startup (if data is >24h stale) and on manual sync, then cached as JSON in SQLite for instant page loads. Docker Compose mounts a named volume for the SQLite file so data persists across container restarts.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Bun runtime, bun:sqlite (built-in), googleapis npm package, shadcn/ui, Tailwind CSS v4, Recharts, Docker Compose

---

## File Structure

```
analytics/
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── README.md
├── next.config.ts
├── tailwind.config.ts
├── components.json
├── package.json
├── tsconfig.json
├── data/                             # SQLite file (gitignored, Docker volume)
│
└── src/
    ├── app/
    │   ├── layout.tsx                # Root layout with sidebar
    │   ├── page.tsx                  # Dashboard — domain cards grid
    │   ├── domain/
    │   │   └── [id]/
    │   │       └── page.tsx          # Domain detail — tabs: Analytics, Search Console, Issues, Opportunities
    │   ├── settings/
    │   │   └── page.tsx              # Settings — OAuth, domains, sync history
    │   └── api/
    │       ├── auth/
    │       │   ├── google/route.ts   # GET → redirect to Google OAuth
    │       │   └── callback/route.ts # GET → exchange code, store tokens, redirect
    │       ├── domains/
    │       │   ├── route.ts          # GET list, POST add
    │       │   └── [id]/
    │       │       ├── route.ts      # DELETE domain
    │       │       ├── discover/route.ts   # GET → find GA4 + GSC properties
    │       │       └── sync/route.ts       # POST → trigger manual sync
    │       ├── data/
    │       │   ├── analytics/route.ts      # GET GA4 cached data
    │       │   ├── search-console/route.ts # GET GSC cached data
    │       │   └── issues/route.ts         # GET issues + CWV cached data
    │       └── sync/startup/route.ts       # POST → startup stale-check sync
    │
    ├── lib/
    │   ├── db/
    │   │   ├── index.ts              # DB singleton + WAL setup
    │   │   ├── schema.ts             # CREATE TABLE SQL + runMigrations()
    │   │   └── queries/
    │   │       ├── domains.ts        # Domain CRUD
    │   │       ├── tokens.ts         # OAuth token CRUD
    │   │       └── cache.ts          # analytics/gsc/issues cache CRUD
    │   ├── google/
    │   │   ├── oauth.ts              # buildAuthUrl, exchangeCode, refreshToken
    │   │   ├── analytics.ts          # fetchGA4Report()
    │   │   └── search-console.ts     # fetchGSCAnalytics(), fetchCrUX(), discoverProperties()
    │   ├── sync/
    │   │   └── index.ts              # syncDomain(), isStale(), startupSync()
    │   ├── crypto.ts                 # encrypt() / decrypt() — AES-256-GCM
    │   └── seo/
    │       └── opportunities.ts      # computeOpportunities() from GSC rows
    │
    ├── components/
    │   ├── ui/                       # shadcn components (generated)
    │   ├── layout/
    │   │   └── sidebar.tsx           # Nav sidebar with domain list
    │   ├── date-range-picker.tsx     # Today/Yesterday/7d/1m/90d/1y preset buttons
    │   ├── domain-card.tsx           # Summary card for dashboard grid
    │   ├── sync-button.tsx           # Manual sync trigger button
    │   ├── analytics/
    │   │   ├── metrics-overview.tsx  # Sessions/Users/Pageviews/Bounce/Duration cards
    │   │   ├── traffic-chart.tsx     # Sessions over time line chart
    │   │   ├── channel-chart.tsx     # Traffic by channel pie/bar chart
    │   │   └── top-pages-table.tsx   # Top pages by sessions
    │   ├── search-console/
    │   │   ├── gsc-overview.tsx      # Clicks/Impressions/CTR/Position cards
    │   │   ├── gsc-chart.tsx         # Clicks + Impressions over time
    │   │   ├── position-buckets.tsx  # Keyword distribution: 1-3, 4-10, 11-20, 20+
    │   │   ├── top-queries-table.tsx # Top queries by clicks
    │   │   └── top-pages-gsc.tsx     # Top pages by GSC clicks
    │   ├── issues/
    │   │   ├── coverage-section.tsx  # Sitemap errors/warnings grouped view
    │   │   └── cwv-section.tsx       # LCP/CLS/INP good/needs-improvement/poor
    │   └── opportunities/
    │       └── opportunities-table.tsx # Quick-win keywords table
    │
    └── types/
        ├── domain.ts
        ├── analytics.ts
        └── search-console.ts
```

---

## Task 1: Project Initialization

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `components.json`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Scaffold Next.js project with Bun**

Run in your local project directory (e.g. `~/analytics` or `C:\Users\<you>\Desktop\analytics`):
```bash
bun create next-app . --typescript --tailwind --app --src-dir --no-eslint --import-alias "@/*"
```
When prompted: yes to all defaults, no to Turbopack (use standard Next.js compiler for Docker compatibility).

- [ ] **Step 2: Install runtime dependencies**

```bash
bun add googleapis recharts lucide-react
bun add class-variance-authority clsx tailwind-merge
```

- [ ] **Step 3: Install dev dependencies**

```bash
bun add -d @testing-library/react @testing-library/jest-dom @types/react @types/react-dom happy-dom
```

- [ ] **Step 4: Initialize shadcn/ui**

```bash
bunx shadcn@latest init -d
bunx shadcn@latest add button card badge table tabs separator skeleton toast
```

- [ ] **Step 5: Create `.env.example`**

```bash
# .env.example
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
ENCRYPTION_KEY=   # generate: openssl rand -hex 32
CRUX_API_KEY=     # Google Cloud Console → APIs → CrUX API key
DB_PATH=./data/analytics.db
```

- [ ] **Step 6: Update `.gitignore` to exclude data and secrets**

Add to `.gitignore`:
```
.env
.env.local
data/
```

- [ ] **Step 7: Verify dev server starts**

```bash
bun run dev
```
Expected: server running at `http://localhost:3000` with default Next.js page.

- [ ] **Step 8: Commit**

```bash
git init
git add -A
git commit -m "feat: initialize Next.js + Bun project with shadcn and Recharts"
```

---

## Task 2: Database Schema and Connection

**Files:**
- Create: `src/lib/db/schema.ts`
- Create: `src/lib/db/index.ts`
- Create: `src/lib/db/queries/domains.ts`
- Create: `src/lib/db/queries/tokens.ts`
- Create: `src/lib/db/queries/cache.ts`
- Create: `src/lib/db/__tests__/schema.test.ts`

- [ ] **Step 1: Create `src/lib/db/schema.ts`**

```typescript
export const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hostname TEXT NOT NULL UNIQUE,
    ga4_property_id TEXT,
    gsc_site_url TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS oauth_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_account_email TEXT NOT NULL,
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT NOT NULL,
    expires_at INTEGER,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain_id INTEGER REFERENCES domains(id) ON DELETE CASCADE,
    synced_at INTEGER NOT NULL DEFAULT (unixepoch()),
    status TEXT NOT NULL DEFAULT 'success'
  );

  CREATE TABLE IF NOT EXISTS analytics_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain_id INTEGER NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    date_range TEXT NOT NULL,
    data_json TEXT NOT NULL,
    synced_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(domain_id, date_range)
  );

  CREATE TABLE IF NOT EXISTS gsc_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain_id INTEGER NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    date_range TEXT NOT NULL,
    data_json TEXT NOT NULL,
    synced_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(domain_id, date_range)
  );

  CREATE TABLE IF NOT EXISTS issues_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain_id INTEGER NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    data_json TEXT NOT NULL,
    synced_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(domain_id)
  );
`
```

- [ ] **Step 2: Write failing test for schema migration**

Create `src/lib/db/__tests__/schema.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "bun:test"
import { Database } from "bun:sqlite"
import { SCHEMA_SQL } from "../schema"

describe("database schema", () => {
  let db: Database

  beforeEach(() => {
    db = new Database(":memory:")
    db.run("PRAGMA foreign_keys=ON")
    db.exec(SCHEMA_SQL)
  })

  it("creates all required tables", () => {
    const tables = db
      .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
    const names = tables.map((t) => t.name)
    expect(names).toContain("domains")
    expect(names).toContain("oauth_tokens")
    expect(names).toContain("sync_log")
    expect(names).toContain("analytics_cache")
    expect(names).toContain("gsc_cache")
    expect(names).toContain("issues_cache")
  })

  it("enforces unique hostname in domains", () => {
    db.run("INSERT INTO domains (hostname) VALUES ('example.com')")
    expect(() =>
      db.run("INSERT INTO domains (hostname) VALUES ('example.com')")
    ).toThrow()
  })

  it("cascades domain delete to sync_log", () => {
    db.run("INSERT INTO domains (hostname) VALUES ('test.com')")
    const { id } = db.query<{ id: number }, []>("SELECT id FROM domains").get()!
    db.run("INSERT INTO sync_log (domain_id) VALUES (?)", [id])
    db.run("DELETE FROM domains WHERE id = ?", [id])
    const logs = db.query<{ id: number }, [number]>("SELECT * FROM sync_log WHERE domain_id = ?").all(id)
    expect(logs).toHaveLength(0)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
bun test src/lib/db/__tests__/schema.test.ts
```
Expected: FAIL — `SCHEMA_SQL` not yet used in a way that the DB connection runs it.

- [ ] **Step 4: Create `src/lib/db/index.ts`**

```typescript
import { Database } from "bun:sqlite"
import { SCHEMA_SQL } from "./schema"

let db: Database | null = null

export function getDb(): Database {
  if (!db) {
    const path = process.env.DB_PATH ?? "./data/analytics.db"
    db = new Database(path, { create: true })
    db.run("PRAGMA journal_mode=WAL")
    db.run("PRAGMA foreign_keys=ON")
    db.exec(SCHEMA_SQL)
  }
  return db
}
```

- [ ] **Step 5: Run test again — expect PASS**

```bash
bun test src/lib/db/__tests__/schema.test.ts
```
Expected: PASS (all 3 tests)

- [ ] **Step 6: Create `src/lib/db/queries/domains.ts`**

```typescript
import type { Database } from "bun:sqlite"

export interface Domain {
  id: number
  hostname: string
  ga4_property_id: string | null
  gsc_site_url: string | null
  created_at: number
}

export function listDomains(db: Database): Domain[] {
  return db.query<Domain, []>("SELECT * FROM domains ORDER BY created_at DESC").all()
}

export function getDomain(db: Database, id: number): Domain | null {
  return db.query<Domain, [number]>("SELECT * FROM domains WHERE id = ?").get(id)
}

export function addDomain(db: Database, hostname: string): Domain {
  db.run("INSERT INTO domains (hostname) VALUES (?)", [hostname])
  return db.query<Domain, [string]>("SELECT * FROM domains WHERE hostname = ?").get(hostname)!
}

export function updateDomainProperties(
  db: Database,
  id: number,
  ga4PropertyId: string | null,
  gscSiteUrl: string | null
): void {
  db.run(
    "UPDATE domains SET ga4_property_id = ?, gsc_site_url = ? WHERE id = ?",
    [ga4PropertyId, gscSiteUrl, id]
  )
}

export function deleteDomain(db: Database, id: number): void {
  db.run("DELETE FROM domains WHERE id = ?", [id])
}
```

- [ ] **Step 7: Create `src/lib/db/queries/tokens.ts`**

```typescript
import type { Database } from "bun:sqlite"

export interface OAuthToken {
  id: number
  google_account_email: string
  access_token_encrypted: string | null
  refresh_token_encrypted: string
  expires_at: number | null
  updated_at: number
}

export function getToken(db: Database): OAuthToken | null {
  return db.query<OAuthToken, []>("SELECT * FROM oauth_tokens LIMIT 1").get()
}

export function upsertToken(
  db: Database,
  email: string,
  refreshTokenEncrypted: string,
  accessTokenEncrypted: string | null,
  expiresAt: number | null
): void {
  const existing = getToken(db)
  if (existing) {
    db.run(
      `UPDATE oauth_tokens SET
        google_account_email = ?,
        refresh_token_encrypted = ?,
        access_token_encrypted = ?,
        expires_at = ?,
        updated_at = unixepoch()
       WHERE id = ?`,
      [email, refreshTokenEncrypted, accessTokenEncrypted, expiresAt, existing.id]
    )
  } else {
    db.run(
      `INSERT INTO oauth_tokens (google_account_email, refresh_token_encrypted, access_token_encrypted, expires_at)
       VALUES (?, ?, ?, ?)`,
      [email, refreshTokenEncrypted, accessTokenEncrypted, expiresAt]
    )
  }
}
```

- [ ] **Step 8: Create `src/lib/db/queries/cache.ts`**

```typescript
import type { Database } from "bun:sqlite"

interface CacheRow {
  id: number
  domain_id: number
  date_range: string
  data_json: string
  synced_at: number
}

interface IssuesCacheRow {
  id: number
  domain_id: number
  data_json: string
  synced_at: number
}

export function getAnalyticsCache(db: Database, domainId: number, dateRange: string): unknown | null {
  const row = db
    .query<CacheRow, [number, string]>(
      "SELECT * FROM analytics_cache WHERE domain_id = ? AND date_range = ?"
    )
    .get(domainId, dateRange)
  return row ? JSON.parse(row.data_json) : null
}

export function setAnalyticsCache(db: Database, domainId: number, dateRange: string, data: unknown): void {
  db.run(
    `INSERT INTO analytics_cache (domain_id, date_range, data_json)
     VALUES (?, ?, ?)
     ON CONFLICT(domain_id, date_range) DO UPDATE SET data_json = excluded.data_json, synced_at = unixepoch()`,
    [domainId, dateRange, JSON.stringify(data)]
  )
}

export function getGscCache(db: Database, domainId: number, dateRange: string): unknown | null {
  const row = db
    .query<CacheRow, [number, string]>(
      "SELECT * FROM gsc_cache WHERE domain_id = ? AND date_range = ?"
    )
    .get(domainId, dateRange)
  return row ? JSON.parse(row.data_json) : null
}

export function setGscCache(db: Database, domainId: number, dateRange: string, data: unknown): void {
  db.run(
    `INSERT INTO gsc_cache (domain_id, date_range, data_json)
     VALUES (?, ?, ?)
     ON CONFLICT(domain_id, date_range) DO UPDATE SET data_json = excluded.data_json, synced_at = unixepoch()`,
    [domainId, dateRange, JSON.stringify(data)]
  )
}

export function getIssuesCache(db: Database, domainId: number): unknown | null {
  const row = db
    .query<IssuesCacheRow, [number]>("SELECT * FROM issues_cache WHERE domain_id = ?")
    .get(domainId)
  return row ? JSON.parse(row.data_json) : null
}

export function setIssuesCache(db: Database, domainId: number, data: unknown): void {
  db.run(
    `INSERT INTO issues_cache (domain_id, data_json)
     VALUES (?, ?)
     ON CONFLICT(domain_id) DO UPDATE SET data_json = excluded.data_json, synced_at = unixepoch()`,
    [domainId, JSON.stringify(data)]
  )
}

export function getLastSyncedAt(db: Database, domainId: number): number | null {
  const row = db
    .query<{ synced_at: number }, [number]>(
      "SELECT synced_at FROM sync_log WHERE domain_id = ? ORDER BY synced_at DESC LIMIT 1"
    )
    .get(domainId)
  return row?.synced_at ?? null
}

export function recordSync(db: Database, domainId: number, status: "success" | "error"): void {
  db.run("INSERT INTO sync_log (domain_id, status) VALUES (?, ?)", [domainId, status])
}
```

- [ ] **Step 9: Create `data/` directory and add to gitignore**

```bash
mkdir -p data
echo "data/" >> .gitignore
```

- [ ] **Step 10: Commit**

```bash
git add src/lib/db/ .gitignore
git commit -m "feat: add SQLite schema, connection singleton, and query helpers"
```

---

## Task 3: Token Encryption Utility

**Files:**
- Create: `src/lib/crypto.ts`
- Create: `src/lib/__tests__/crypto.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/__tests__/crypto.test.ts`:
```typescript
import { describe, it, expect } from "bun:test"

describe("crypto encrypt/decrypt", () => {
  it("round-trips a string", async () => {
    process.env.ENCRYPTION_KEY = "a".repeat(64) // 32-byte hex
    const { encrypt, decrypt } = await import("../crypto")
    const original = "my-secret-refresh-token"
    const encrypted = encrypt(original)
    expect(encrypted).not.toBe(original)
    expect(encrypted).toContain(":") // iv:authTag:ciphertext format
    expect(decrypt(encrypted)).toBe(original)
  })

  it("produces different ciphertext for same input (random IV)", async () => {
    process.env.ENCRYPTION_KEY = "a".repeat(64)
    const { encrypt } = await import("../crypto")
    const a = encrypt("same")
    const b = encrypt("same")
    expect(a).not.toBe(b)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test src/lib/__tests__/crypto.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Create `src/lib/crypto.ts`**

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const ALGORITHM = "aes-256-gcm"

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key || key.length !== 64) throw new Error("ENCRYPTION_KEY must be a 64-char hex string")
  return Buffer.from(key, "hex")
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":")
}

export function decrypt(ciphertext: string): string {
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(":")
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"))
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]).toString("utf8")
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
bun test src/lib/__tests__/crypto.test.ts
```
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/crypto.ts src/lib/__tests__/crypto.test.ts
git commit -m "feat: add AES-256-GCM encrypt/decrypt for OAuth token storage"
```

---

## Task 4: Google OAuth Flow

**Files:**
- Create: `src/lib/google/oauth.ts`
- Create: `src/app/api/auth/google/route.ts`
- Create: `src/app/api/auth/callback/route.ts`
- Create: `src/types/domain.ts`

- [ ] **Step 1: Create `src/types/domain.ts`**

```typescript
export interface Domain {
  id: number
  hostname: string
  ga4PropertyId: string | null
  gscSiteUrl: string | null
  createdAt: number
}

export interface SyncStatus {
  domainId: number
  lastSyncedAt: number | null
  isStale: boolean
}

export interface DiscoveryResult {
  ga4Properties: { id: string; displayName: string }[]
  gscSites: { siteUrl: string }[]
}
```

- [ ] **Step 2: Create `src/lib/google/oauth.ts`**

```typescript
import { google } from "googleapis"

const SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
]

export function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`
  )
}

export function buildAuthUrl(): string {
  const client = createOAuthClient()
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  })
}

export interface TokenSet {
  accessToken: string
  refreshToken: string
  expiresAt: number
  email: string
}

export async function exchangeCode(code: string): Promise<TokenSet> {
  const client = createOAuthClient()
  const { tokens } = await client.getToken(code)
  if (!tokens.refresh_token) throw new Error("No refresh token returned — ensure prompt=consent")

  client.setCredentials(tokens)
  const oauth2 = google.oauth2({ version: "v2", auth: client })
  const { data } = await oauth2.userinfo.get()

  return {
    accessToken: tokens.access_token!,
    refreshToken: tokens.refresh_token,
    expiresAt: tokens.expiry_date ?? Date.now() + 3600_000,
    email: data.email!,
  }
}

export async function getValidAccessToken(refreshTokenEncrypted: string): Promise<string> {
  const { decrypt } = await import("../crypto")
  const client = createOAuthClient()
  client.setCredentials({ refresh_token: decrypt(refreshTokenEncrypted) })
  const { token } = await client.getAccessToken()
  if (!token) throw new Error("Failed to refresh access token")
  return token
}
```

- [ ] **Step 3: Create `src/app/api/auth/google/route.ts`**

```typescript
import { NextResponse } from "next/server"
import { buildAuthUrl } from "@/lib/google/oauth"

export function GET() {
  return NextResponse.redirect(buildAuthUrl())
}
```

- [ ] **Step 4: Create `src/app/api/auth/callback/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { exchangeCode } from "@/lib/google/oauth"
import { encrypt } from "@/lib/crypto"
import { getDb } from "@/lib/db"
import { upsertToken } from "@/lib/db/queries/tokens"

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 })

  try {
    const tokens = await exchangeCode(code)
    const db = getDb()
    upsertToken(
      db,
      tokens.email,
      encrypt(tokens.refreshToken),
      encrypt(tokens.accessToken),
      tokens.expiresAt
    )
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?auth=success`)
  } catch (err) {
    console.error("OAuth callback error:", err)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?auth=error`)
  }
}
```

- [ ] **Step 5: Verify OAuth flow manually**

Start the dev server:
```bash
bun run dev
```
Navigate to `http://localhost:3000/api/auth/google` — should redirect to Google login. (Full test requires valid `.env` with Google credentials.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/google/oauth.ts src/app/api/auth/ src/types/
git commit -m "feat: add Google OAuth flow with token storage"
```

---

## Task 5: GA4 API Client

**Files:**
- Create: `src/lib/google/analytics.ts`
- Create: `src/types/analytics.ts`
- Create: `src/lib/google/__tests__/analytics.test.ts`

- [ ] **Step 1: Create `src/types/analytics.ts`**

```typescript
export interface AnalyticsOverview {
  sessions: number
  users: number
  pageviews: number
  bounceRate: number
  avgSessionDuration: number
}

export interface ChannelRow {
  channel: string
  sessions: number
}

export interface PageRow {
  pagePath: string
  sessions: number
  pageviews: number
}

export interface DailyRow {
  date: string
  sessions: number
  users: number
}

export interface AnalyticsReport {
  overview: AnalyticsOverview
  channels: ChannelRow[]
  topPages: PageRow[]
  daily: DailyRow[]
}
```

- [ ] **Step 2: Write failing test**

Create `src/lib/google/__tests__/analytics.test.ts`:
```typescript
import { describe, it, expect, mock, beforeEach } from "bun:test"

const mockRunReport = mock(async () => ({
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

mock.module("googleapis", () => ({
  google: {
    analyticsdata: () => ({
      properties: {
        runReport: mockRunReport,
      },
    }),
    auth: {
      OAuth2: class {
        setCredentials() {}
        getAccessToken() { return { token: "fake-token" } }
      },
    },
  },
}))

describe("fetchGA4Report", () => {
  it("returns structured analytics report", async () => {
    const { fetchGA4Report } = await import("../analytics")
    const result = await fetchGA4Report("properties/123", "fake-access-token", "2025-01-01", "2025-01-31")
    expect(result.overview.sessions).toBeGreaterThan(0)
    expect(result.daily).toBeInstanceOf(Array)
    expect(result.channels).toBeInstanceOf(Array)
    expect(result.topPages).toBeInstanceOf(Array)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
bun test src/lib/google/__tests__/analytics.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 4: Create `src/lib/google/analytics.ts`**

```typescript
import { google } from "googleapis"
import type { AnalyticsReport, ChannelRow, PageRow, DailyRow } from "@/types/analytics"

export async function fetchGA4Report(
  propertyId: string,
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<AnalyticsReport> {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth })

  const [overviewRes, channelsRes, pagesRes, dailyRes] = await Promise.all([
    analyticsdata.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        metrics: [
          { name: "sessions" },
          { name: "totalUsers" },
          { name: "screenPageViews" },
          { name: "bounceRate" },
          { name: "averageSessionDuration" },
        ],
      },
    }),
    analyticsdata.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      },
    }),
    analyticsdata.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "sessions" }, { name: "screenPageViews" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 20,
      },
    }),
    analyticsdata.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "date" }],
        metrics: [{ name: "sessions" }, { name: "totalUsers" }],
        orderBys: [{ dimension: { dimensionName: "date" } }],
      },
    }),
  ])

  const totals = overviewRes.data.totals?.[0]?.metricValues ?? []

  const overview = {
    sessions: Number(totals[0]?.value ?? 0),
    users: Number(totals[1]?.value ?? 0),
    pageviews: Number(totals[2]?.value ?? 0),
    bounceRate: Number(totals[3]?.value ?? 0),
    avgSessionDuration: Number(totals[4]?.value ?? 0),
  }

  const channels: ChannelRow[] = (channelsRes.data.rows ?? []).map((r) => ({
    channel: r.dimensionValues?.[0]?.value ?? "Unknown",
    sessions: Number(r.metricValues?.[0]?.value ?? 0),
  }))

  const topPages: PageRow[] = (pagesRes.data.rows ?? []).map((r) => ({
    pagePath: r.dimensionValues?.[0]?.value ?? "/",
    sessions: Number(r.metricValues?.[0]?.value ?? 0),
    pageviews: Number(r.metricValues?.[1]?.value ?? 0),
  }))

  const daily: DailyRow[] = (dailyRes.data.rows ?? []).map((r) => ({
    date: r.dimensionValues?.[0]?.value ?? "",
    sessions: Number(r.metricValues?.[0]?.value ?? 0),
    users: Number(r.metricValues?.[1]?.value ?? 0),
  }))

  return { overview, channels, topPages, daily }
}
```

- [ ] **Step 5: Run test — expect PASS**

```bash
bun test src/lib/google/__tests__/analytics.test.ts
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/google/analytics.ts src/types/analytics.ts src/lib/google/__tests__/analytics.test.ts
git commit -m "feat: add GA4 Data API client with overview, channels, pages, and daily data"
```

---

## Task 6: GSC + CrUX API Client

**Files:**
- Create: `src/lib/google/search-console.ts`
- Create: `src/types/search-console.ts`
- Create: `src/lib/google/__tests__/search-console.test.ts`

- [ ] **Step 1: Create `src/types/search-console.ts`**

```typescript
export interface GscOverview {
  totalClicks: number
  totalImpressions: number
  avgCtr: number
  avgPosition: number
}

export interface QueryRow {
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface GscPageRow {
  page: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface DailyGscRow {
  date: string
  clicks: number
  impressions: number
}

export interface PositionBuckets {
  top3: number     // positions 1-3
  page1: number    // positions 4-10
  page2: number    // positions 11-20
  beyond: number   // positions 21+
}

export interface GscReport {
  overview: GscOverview
  topQueries: QueryRow[]
  topPages: GscPageRow[]
  daily: DailyGscRow[]
  positionBuckets: PositionBuckets
}

export interface SitemapInfo {
  path: string
  errors: number
  warnings: number
  indexed: number
  submitted: number
}

export interface CwvMetric {
  good: number
  needsImprovement: number
  poor: number
}

export interface IssuesReport {
  sitemaps: SitemapInfo[]
  cwv: {
    lcp: CwvMetric | null
    cls: CwvMetric | null
    inp: CwvMetric | null
  }
}
```

- [ ] **Step 2: Create `src/lib/google/search-console.ts`**

```typescript
import { google } from "googleapis"
import type { GscReport, QueryRow, GscPageRow, DailyGscRow, PositionBuckets, IssuesReport, SitemapInfo, CwvMetric } from "@/types/search-console"

export async function fetchGSCReport(
  siteUrl: string,
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<GscReport> {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const webmasters = google.webmasters({ version: "v3", auth })

  const [queriesRes, pagesRes, dailyRes] = await Promise.all([
    webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ["query"],
        rowLimit: 25,
        aggregationType: "byPage",
      },
    }),
    webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ["page"],
        rowLimit: 25,
      },
    }),
    webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ["date"],
        rowLimit: 500,
      },
    }),
  ])

  const queryRows: QueryRow[] = (queriesRes.data.rows ?? []).map((r) => ({
    query: r.keys?.[0] ?? "",
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }))

  const topPages: GscPageRow[] = (pagesRes.data.rows ?? []).map((r) => ({
    page: r.keys?.[0] ?? "",
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }))

  const daily: DailyGscRow[] = (dailyRes.data.rows ?? []).map((r) => ({
    date: r.keys?.[0] ?? "",
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
  }))

  const totalClicks = queryRows.reduce((s, r) => s + r.clicks, 0)
  const totalImpressions = queryRows.reduce((s, r) => s + r.impressions, 0)
  const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0
  const avgPosition =
    queryRows.length > 0
      ? queryRows.reduce((s, r) => s + r.position, 0) / queryRows.length
      : 0

  const positionBuckets: PositionBuckets = {
    top3: queryRows.filter((r) => r.position <= 3).length,
    page1: queryRows.filter((r) => r.position > 3 && r.position <= 10).length,
    page2: queryRows.filter((r) => r.position > 10 && r.position <= 20).length,
    beyond: queryRows.filter((r) => r.position > 20).length,
  }

  return {
    overview: { totalClicks, totalImpressions, avgCtr, avgPosition },
    topQueries: queryRows,
    topPages,
    daily,
    positionBuckets,
  }
}

export async function fetchSitemaps(siteUrl: string, accessToken: string): Promise<SitemapInfo[]> {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const webmasters = google.webmasters({ version: "v3", auth })

  const res = await webmasters.sitemaps.list({ siteUrl })
  return (res.data.sitemap ?? []).map((s) => ({
    path: s.path ?? "",
    errors: s.errors ? Number(s.errors) : 0,
    warnings: s.warnings ? Number(s.warnings) : 0,
    indexed: s.contents?.[0]?.indexed ? Number(s.contents[0].indexed) : 0,
    submitted: s.contents?.[0]?.submitted ? Number(s.contents[0].submitted) : 0,
  }))
}

export async function fetchCrUX(origin: string, cruxApiKey: string): Promise<IssuesReport["cwv"]> {
  const url = `https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${cruxApiKey}`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ origin, formFactor: "PHONE" }),
  })

  if (!res.ok) return { lcp: null, cls: null, inp: null }

  const data = await res.json()
  const metrics = data.record?.metrics ?? {}

  function toMetric(m: { histogram?: { density: number }[] } | undefined): CwvMetric | null {
    if (!m?.histogram) return null
    return {
      good: Math.round((m.histogram[0]?.density ?? 0) * 100),
      needsImprovement: Math.round((m.histogram[1]?.density ?? 0) * 100),
      poor: Math.round((m.histogram[2]?.density ?? 0) * 100),
    }
  }

  return {
    lcp: toMetric(metrics.largest_contentful_paint),
    cls: toMetric(metrics.cumulative_layout_shift),
    inp: toMetric(metrics.interaction_to_next_paint),
  }
}

export async function discoverProperties(
  accessToken: string
): Promise<{ ga4Properties: { id: string; displayName: string }[]; gscSites: { siteUrl: string }[] }> {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })

  const [analyticsAdmin, webmasters] = await Promise.all([
    google.analyticsadmin({ version: "v1beta", auth }).accounts.list({}),
    google.webmasters({ version: "v3", auth }).sites.list(),
  ])

  // GA4: list properties under each account
  const adminClient = google.analyticsadmin({ version: "v1beta", auth })
  const ga4Properties: { id: string; displayName: string }[] = []
  for (const account of analyticsAdmin.data.accounts ?? []) {
    const propsRes = await adminClient.properties.list({ filter: `parent:${account.name}` })
    for (const prop of propsRes.data.properties ?? []) {
      ga4Properties.push({ id: prop.name!, displayName: prop.displayName ?? prop.name! })
    }
  }

  const gscSites = (webmasters.data.siteEntry ?? []).map((s) => ({ siteUrl: s.siteUrl! }))
  return { ga4Properties, gscSites }
}
```

- [ ] **Step 3: Write failing test for opportunities computation (in next task — skip GSC mock test to avoid complexity)**

- [ ] **Step 4: Commit**

```bash
git add src/lib/google/search-console.ts src/types/search-console.ts
git commit -m "feat: add GSC search analytics, sitemap, and CrUX API clients"
```

---

## Task 7: SEO Opportunities Computation

**Files:**
- Create: `src/lib/seo/opportunities.ts`
- Create: `src/lib/seo/__tests__/opportunities.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/seo/__tests__/opportunities.test.ts`:
```typescript
import { describe, it, expect } from "bun:test"
import { computeOpportunities } from "../opportunities"
import type { QueryRow } from "@/types/search-console"

describe("computeOpportunities", () => {
  const queries: QueryRow[] = [
    { query: "best seo tool", clicks: 5, impressions: 500, ctr: 0.01, position: 7.2 },
    { query: "seo analytics", clicks: 2, impressions: 300, ctr: 0.006, position: 12.5 },
    { query: "top ranking tool", clicks: 50, impressions: 600, ctr: 0.083, position: 1.5 },
    { query: "free analytics", clicks: 1, impressions: 80, ctr: 0.012, position: 9.8 },
    { query: "obscure phrase", clicks: 0, impressions: 5, ctr: 0, position: 18 },
  ]

  it("returns keywords in position 4-20 with impressions above threshold", () => {
    const results = computeOpportunities(queries)
    const positions = results.map((r) => r.position)
    expect(positions.every((p) => p >= 4 && p <= 20)).toBe(true)
  })

  it("excludes keywords with high CTR relative to their peers", () => {
    const results = computeOpportunities(queries)
    // 'top ranking tool' is position 1.5, should not appear
    expect(results.find((r) => r.query === "top ranking tool")).toBeUndefined()
  })

  it("excludes keywords below median impressions", () => {
    const results = computeOpportunities(queries)
    // 'obscure phrase' has only 5 impressions — below median
    expect(results.find((r) => r.query === "obscure phrase")).toBeUndefined()
  })

  it("includes an opportunityScore field", () => {
    const results = computeOpportunities(queries)
    expect(results[0]).toHaveProperty("opportunityScore")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test src/lib/seo/__tests__/opportunities.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Create `src/lib/seo/opportunities.ts`**

```typescript
import type { QueryRow } from "@/types/search-console"

export interface OpportunityRow extends QueryRow {
  opportunityScore: number
}

export function computeOpportunities(queries: QueryRow[]): OpportunityRow[] {
  const candidates = queries.filter((q) => q.position >= 4 && q.position <= 20)
  if (candidates.length === 0) return []

  const impressions = candidates.map((q) => q.impressions).sort((a, b) => a - b)
  const medianImpressions = impressions[Math.floor(impressions.length / 2)]

  const avgCtr = candidates.reduce((s, q) => s + q.ctr, 0) / candidates.length

  return candidates
    .filter((q) => q.impressions >= medianImpressions && q.ctr <= avgCtr)
    .map((q) => ({
      ...q,
      // Higher score = better opportunity: high impressions, low position, low CTR
      opportunityScore: Math.round(
        (q.impressions / (q.position * Math.max(q.ctr, 0.001))) * 10
      ),
    }))
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
bun test src/lib/seo/__tests__/opportunities.test.ts
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/seo/ 
git commit -m "feat: add SEO opportunity scoring for quick-win keyword detection"
```

---

## Task 8: Sync Orchestrator

**Files:**
- Create: `src/lib/sync/index.ts`
- Create: `src/app/api/sync/startup/route.ts`
- Create: `src/app/api/domains/[id]/sync/route.ts`

- [ ] **Step 1: Create `src/lib/sync/index.ts`**

```typescript
import { getDb } from "@/lib/db"
import { listDomains, getDomain } from "@/lib/db/queries/domains"
import { getToken } from "@/lib/db/queries/tokens"
import { setAnalyticsCache, setGscCache, setIssuesCache, getLastSyncedAt, recordSync } from "@/lib/db/queries/cache"
import { getValidAccessToken } from "@/lib/google/oauth"
import { fetchGA4Report } from "@/lib/google/analytics"
import { fetchGSCReport, fetchSitemaps, fetchCrUX } from "@/lib/google/search-console"
import { decrypt } from "@/lib/crypto"

const DATE_RANGES = [
  { key: "today", startDate: () => formatDate(new Date()), endDate: () => formatDate(new Date()) },
  { key: "yesterday", startDate: () => formatDate(daysAgo(1)), endDate: () => formatDate(daysAgo(1)) },
  { key: "7d", startDate: () => formatDate(daysAgo(7)), endDate: () => formatDate(new Date()) },
  { key: "1m", startDate: () => formatDate(daysAgo(30)), endDate: () => formatDate(new Date()) },
  { key: "90d", startDate: () => formatDate(daysAgo(90)), endDate: () => formatDate(new Date()) },
  { key: "1y", startDate: () => formatDate(daysAgo(365)), endDate: () => formatDate(new Date()) },
]

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0]
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

const STALE_THRESHOLD_SECONDS = 24 * 60 * 60 // 24 hours

export function isStale(lastSyncedAt: number | null): boolean {
  if (!lastSyncedAt) return true
  return Date.now() / 1000 - lastSyncedAt > STALE_THRESHOLD_SECONDS
}

export async function syncDomain(domainId: number): Promise<void> {
  const db = getDb()
  const domain = getDomain(db, domainId)
  if (!domain) throw new Error(`Domain ${domainId} not found`)

  const tokenRow = getToken(db)
  if (!tokenRow) throw new Error("No OAuth token — connect Google account first")

  try {
    const accessToken = await getValidAccessToken(tokenRow.refresh_token_encrypted)

    // Sync GA4 for all date ranges
    if (domain.ga4_property_id) {
      for (const range of DATE_RANGES) {
        const data = await fetchGA4Report(
          domain.ga4_property_id,
          accessToken,
          range.startDate(),
          range.endDate()
        )
        setAnalyticsCache(db, domainId, range.key, data)
      }
    }

    // Sync GSC for all date ranges
    if (domain.gsc_site_url) {
      for (const range of DATE_RANGES) {
        const data = await fetchGSCReport(
          domain.gsc_site_url,
          accessToken,
          range.startDate(),
          range.endDate()
        )
        setGscCache(db, domainId, range.key, data)
      }

      // Sync issues (sitemaps + CrUX)
      const [sitemaps, cwv] = await Promise.all([
        fetchSitemaps(domain.gsc_site_url, accessToken),
        fetchCrUX(
          domain.gsc_site_url.startsWith("sc-domain:")
            ? `https://${domain.gsc_site_url.replace("sc-domain:", "")}`
            : domain.gsc_site_url,
          process.env.CRUX_API_KEY ?? ""
        ),
      ])
      setIssuesCache(db, domainId, { sitemaps, cwv })
    }

    recordSync(db, domainId, "success")
  } catch (err) {
    recordSync(db, domainId, "error")
    throw err
  }
}

export async function startupSync(): Promise<void> {
  const db = getDb()
  const domains = listDomains(db)
  for (const domain of domains) {
    const lastSync = getLastSyncedAt(db, domain.id)
    if (isStale(lastSync)) {
      await syncDomain(domain.id).catch(console.error)
    }
  }
}
```

- [ ] **Step 2: Write test for `isStale`**

Add to a new file `src/lib/sync/__tests__/sync.test.ts`:
```typescript
import { describe, it, expect } from "bun:test"
import { isStale } from "../index"

describe("isStale", () => {
  it("returns true when lastSyncedAt is null", () => {
    expect(isStale(null)).toBe(true)
  })

  it("returns true when last sync was over 24 hours ago", () => {
    const twoDaysAgo = Math.floor(Date.now() / 1000) - 48 * 60 * 60
    expect(isStale(twoDaysAgo)).toBe(true)
  })

  it("returns false when last sync was recent", () => {
    const oneHourAgo = Math.floor(Date.now() / 1000) - 3600
    expect(isStale(oneHourAgo)).toBe(false)
  })
})
```

- [ ] **Step 3: Run test — expect PASS**

```bash
bun test src/lib/sync/__tests__/sync.test.ts
```
Expected: PASS (3 tests)

- [ ] **Step 4: Create `src/app/api/sync/startup/route.ts`**

```typescript
import { NextResponse } from "next/server"
import { startupSync } from "@/lib/sync"

export async function POST() {
  try {
    await startupSync()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("Startup sync error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
```

- [ ] **Step 5: Create `src/app/api/domains/[id]/sync/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { syncDomain } from "@/lib/sync"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const domainId = Number(id)
  if (isNaN(domainId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  try {
    await syncDomain(domainId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("Sync error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/sync/ src/app/api/sync/ src/app/api/domains/
git commit -m "feat: add sync orchestrator with stale-check logic and startup sync"
```

---

## Task 9: Domain Management API Routes

**Files:**
- Create: `src/app/api/domains/route.ts`
- Create: `src/app/api/domains/[id]/route.ts`
- Create: `src/app/api/domains/[id]/discover/route.ts`

- [ ] **Step 1: Create `src/app/api/domains/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { listDomains, addDomain } from "@/lib/db/queries/domains"

export function GET() {
  const db = getDb()
  const domains = listDomains(db)
  return NextResponse.json(domains)
}

export async function POST(req: NextRequest) {
  const { hostname } = await req.json()
  if (!hostname || typeof hostname !== "string") {
    return NextResponse.json({ error: "hostname required" }, { status: 400 })
  }
  const clean = hostname.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase()
  try {
    const db = getDb()
    const domain = addDomain(db, clean)
    return NextResponse.json(domain, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Domain already exists" }, { status: 409 })
  }
}
```

- [ ] **Step 2: Create `src/app/api/domains/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { deleteDomain, getDomain, updateDomainProperties } from "@/lib/db/queries/domains"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const domainId = Number(id)
  const { ga4PropertyId, gscSiteUrl } = await req.json()
  const db = getDb()
  updateDomainProperties(db, domainId, ga4PropertyId ?? null, gscSiteUrl ?? null)
  return NextResponse.json(getDomain(db, domainId))
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  deleteDomain(db, Number(id))
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 3: Create `src/app/api/domains/[id]/discover/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getToken } from "@/lib/db/queries/tokens"
import { getValidAccessToken } from "@/lib/google/oauth"
import { discoverProperties } from "@/lib/google/search-console"
import { getDomain } from "@/lib/db/queries/domains"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const domain = getDomain(db, Number(id))
  if (!domain) return NextResponse.json({ error: "Domain not found" }, { status: 404 })

  const tokenRow = getToken(db)
  if (!tokenRow) return NextResponse.json({ error: "Not authenticated with Google" }, { status: 401 })

  try {
    const accessToken = await getValidAccessToken(tokenRow.refresh_token_encrypted)
    const result = await discoverProperties(accessToken)

    // Filter GSC sites matching this domain
    const matchingGsc = result.gscSites.filter(
      (s) => s.siteUrl.includes(domain.hostname) || s.siteUrl.replace("sc-domain:", "") === domain.hostname
    )

    return NextResponse.json({ ga4Properties: result.ga4Properties, gscSites: matchingGsc })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/domains/
git commit -m "feat: add domain CRUD API routes with auto-discovery"
```

---

## Task 10: Data Read API Routes

**Files:**
- Create: `src/app/api/data/analytics/route.ts`
- Create: `src/app/api/data/search-console/route.ts`
- Create: `src/app/api/data/issues/route.ts`

- [ ] **Step 1: Create `src/app/api/data/analytics/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getAnalyticsCache } from "@/lib/db/queries/cache"

export function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const domainId = Number(searchParams.get("domainId"))
  const dateRange = searchParams.get("dateRange") ?? "28d"
  if (isNaN(domainId)) return NextResponse.json({ error: "domainId required" }, { status: 400 })

  const db = getDb()
  const data = getAnalyticsCache(db, domainId, dateRange)
  if (!data) return NextResponse.json({ error: "No data — sync first" }, { status: 404 })
  return NextResponse.json(data)
}
```

- [ ] **Step 2: Create `src/app/api/data/search-console/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getGscCache } from "@/lib/db/queries/cache"

export function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const domainId = Number(searchParams.get("domainId"))
  const dateRange = searchParams.get("dateRange") ?? "28d"
  if (isNaN(domainId)) return NextResponse.json({ error: "domainId required" }, { status: 400 })

  const db = getDb()
  const data = getGscCache(db, domainId, dateRange)
  if (!data) return NextResponse.json({ error: "No data — sync first" }, { status: 404 })
  return NextResponse.json(data)
}
```

- [ ] **Step 3: Create `src/app/api/data/issues/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getIssuesCache } from "@/lib/db/queries/cache"
import { computeOpportunities } from "@/lib/seo/opportunities"
import type { GscReport } from "@/types/search-console"

export function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const domainId = Number(searchParams.get("domainId"))
  const type = searchParams.get("type") ?? "issues"
  if (isNaN(domainId)) return NextResponse.json({ error: "domainId required" }, { status: 400 })

  const db = getDb()

  if (type === "opportunities") {
    // Use 28-day GSC data for opportunities
    const { getGscCache } = require("@/lib/db/queries/cache")
    const gscData = getGscCache(db, domainId, "1m") as GscReport | null
    if (!gscData) return NextResponse.json({ error: "No GSC data — sync first" }, { status: 404 })
    return NextResponse.json(computeOpportunities(gscData.topQueries))
  }

  const data = getIssuesCache(db, domainId)
  if (!data) return NextResponse.json({ error: "No data — sync first" }, { status: 404 })
  return NextResponse.json(data)
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/data/
git commit -m "feat: add data read API routes for analytics, GSC, issues, and opportunities"
```

---

## Task 11: App Layout and Navigation

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Create `src/components/layout/sidebar.tsx`**

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart2, Settings, Globe } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "Dashboard", icon: BarChart2 },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-56 min-h-screen border-r bg-background flex flex-col">
      <div className="px-4 py-5 border-b">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Globe className="w-4 h-4" />
          SEO Dashboard
        </div>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                pathname === item.href
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 2: Update `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Sidebar } from "@/components/layout/sidebar"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "SEO Dashboard",
  description: "Personal SEO analytics dashboard",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 p-6 bg-muted/20">{children}</main>
        </div>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Create `src/components/date-range-picker.tsx`**

```tsx
"use client"

const DATE_RANGES = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "7 days" },
  { key: "1m", label: "1 month" },
  { key: "90d", label: "90 days" },
  { key: "1y", label: "1 year" },
] as const

export type DateRangeKey = (typeof DATE_RANGES)[number]["key"]

interface DateRangePickerProps {
  selected: DateRangeKey
  onChange: (key: DateRangeKey) => void
}

export function DateRangePicker({ selected, onChange }: DateRangePickerProps) {
  return (
    <div className="flex gap-1 flex-wrap">
      {DATE_RANGES.map((range) => (
        <button
          key={range.key}
          onClick={() => onChange(range.key)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            selected === range.key
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          }`}
        >
          {range.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Create `src/components/sync-button.tsx`**

```tsx
"use client"

import { useState } from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export function SyncButton({ domainId, onSynced }: { domainId: number; onSynced?: () => void }) {
  const [loading, setLoading] = useState(false)

  async function handleSync() {
    setLoading(true)
    try {
      await fetch(`/api/domains/${domainId}/sync`, { method: "POST" })
      onSynced?.()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleSync} disabled={loading}>
      <RefreshCw className={`w-3 h-3 mr-1.5 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Syncing…" : "Sync"}
    </Button>
  )
}
```

- [ ] **Step 5: Verify layout renders**

```bash
bun run dev
```
Open `http://localhost:3000` — should show sidebar with nav links and main content area.

- [ ] **Step 6: Commit**

```bash
git add src/app/layout.tsx src/components/layout/ src/components/date-range-picker.tsx src/components/sync-button.tsx
git commit -m "feat: add app layout with sidebar, date range picker, and sync button"
```

---

## Task 12: Dashboard Page

**Files:**
- Create: `src/components/domain-card.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create `src/components/domain-card.tsx`**

```tsx
import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Globe, AlertTriangle, TrendingUp } from "lucide-react"

interface DomainCardProps {
  id: number
  hostname: string
  sessions: number | null
  avgPosition: number | null
  issueCount: number
  lastSyncedAt: number | null
}

export function DomainCard({ id, hostname, sessions, avgPosition, issueCount, lastSyncedAt }: DomainCardProps) {
  const syncAgo = lastSyncedAt
    ? Math.round((Date.now() / 1000 - lastSyncedAt) / 3600)
    : null

  return (
    <Link href={`/domain/${id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm truncate max-w-[160px]">{hostname}</span>
            </div>
            {issueCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {issueCount}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Sessions (28d)</p>
              <p className="text-lg font-semibold">{sessions?.toLocaleString() ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg Position</p>
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-muted-foreground" />
                <p className="text-lg font-semibold">{avgPosition ? avgPosition.toFixed(1) : "—"}</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {syncAgo !== null ? `Synced ${syncAgo}h ago` : "Never synced"}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}
```

- [ ] **Step 2: Update `src/app/page.tsx`**

```tsx
import { getDb } from "@/lib/db"
import { listDomains } from "@/lib/db/queries/domains"
import { getAnalyticsCache, getGscCache, getIssuesCache, getLastSyncedAt } from "@/lib/db/queries/cache"
import { DomainCard } from "@/components/domain-card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import type { AnalyticsReport } from "@/types/analytics"
import type { GscReport, IssuesReport } from "@/types/search-console"

export const dynamic = "force-dynamic"

export default function DashboardPage() {
  const db = getDb()
  const domains = listDomains(db)

  const cards = domains.map((domain) => {
    const analytics = getAnalyticsCache(db, domain.id, "1m") as AnalyticsReport | null
    const gsc = getGscCache(db, domain.id, "1m") as GscReport | null
    const issues = getIssuesCache(db, domain.id) as IssuesReport | null
    const lastSyncedAt = getLastSyncedAt(db, domain.id)

    const issueCount =
      (issues?.sitemaps.reduce((s, sm) => s + sm.errors, 0) ?? 0) +
      (issues?.cwv.lcp?.poor ? 1 : 0) +
      (issues?.cwv.cls?.poor ? 1 : 0) +
      (issues?.cwv.inp?.poor ? 1 : 0)

    return {
      id: domain.id,
      hostname: domain.hostname,
      sessions: analytics?.overview.sessions ?? null,
      avgPosition: gsc?.overview.avgPosition ?? null,
      issueCount,
      lastSyncedAt,
    }
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <Link href="/settings">
          <Button variant="outline" size="sm">+ Add Domain</Button>
        </Link>
      </div>

      {cards.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="mb-3">No domains yet.</p>
          <Link href="/settings">
            <Button size="sm">Add your first domain</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => (
            <DomainCard key={card.id} {...card} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx src/components/domain-card.tsx
git commit -m "feat: add dashboard page with domain cards grid"
```

---

## Task 13: Domain Detail Page

**Files:**
- Create: `src/app/domain/[id]/page.tsx`
- Create: `src/components/analytics/metrics-overview.tsx`
- Create: `src/components/analytics/traffic-chart.tsx`
- Create: `src/components/analytics/channel-chart.tsx`
- Create: `src/components/analytics/top-pages-table.tsx`
- Create: `src/components/search-console/gsc-overview.tsx`
- Create: `src/components/search-console/gsc-chart.tsx`
- Create: `src/components/search-console/position-buckets.tsx`
- Create: `src/components/search-console/top-queries-table.tsx`

- [ ] **Step 1: Create `src/components/analytics/metrics-overview.tsx`**

```tsx
import { Card, CardContent } from "@/components/ui/card"
import type { AnalyticsOverview } from "@/types/analytics"

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold mt-1">{value}</p>
      </CardContent>
    </Card>
  )
}

export function MetricsOverview({ data }: { data: AnalyticsOverview }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <MetricCard label="Sessions" value={data.sessions.toLocaleString()} />
      <MetricCard label="Users" value={data.users.toLocaleString()} />
      <MetricCard label="Pageviews" value={data.pageviews.toLocaleString()} />
      <MetricCard label="Bounce Rate" value={`${(data.bounceRate * 100).toFixed(1)}%`} />
      <MetricCard label="Avg Duration" value={`${Math.round(data.avgSessionDuration)}s`} />
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/analytics/traffic-chart.tsx`**

```tsx
"use client"

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"
import type { DailyRow } from "@/types/analytics"

export function TrafficChart({ data }: { data: DailyRow[] }) {
  const formatted = data.map((d) => ({
    ...d,
    date: `${d.date.slice(4, 6)}/${d.date.slice(6, 8)}`,
  }))
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Line type="monotone" dataKey="sessions" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Sessions" />
        <Line type="monotone" dataKey="users" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} dot={false} name="Users" />
      </LineChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 3: Create `src/components/analytics/channel-chart.tsx`**

```tsx
"use client"

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import type { ChannelRow } from "@/types/analytics"

const COLORS = ["hsl(var(--primary))", "hsl(220 60% 60%)", "hsl(160 60% 50%)", "hsl(40 80% 55%)", "hsl(280 60% 60%)"]

export function ChannelChart({ data }: { data: ChannelRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical">
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis dataKey="channel" type="category" tick={{ fontSize: 11 }} width={110} />
        <Tooltip />
        <Bar dataKey="sessions" name="Sessions" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 4: Create `src/components/analytics/top-pages-table.tsx`**

```tsx
import type { PageRow } from "@/types/analytics"

export function TopPagesTable({ data }: { data: PageRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="text-left pb-2 font-medium">Page</th>
            <th className="text-right pb-2 font-medium">Sessions</th>
            <th className="text-right pb-2 font-medium">Pageviews</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 10).map((row, i) => (
            <tr key={i} className="border-b last:border-0">
              <td className="py-2 font-mono text-xs truncate max-w-[240px]">{row.pagePath}</td>
              <td className="py-2 text-right">{row.sessions.toLocaleString()}</td>
              <td className="py-2 text-right">{row.pageviews.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 5: Create `src/components/search-console/gsc-overview.tsx`**

```tsx
import { Card, CardContent } from "@/components/ui/card"
import type { GscOverview } from "@/types/search-console"

export function GscOverview({ data }: { data: GscOverview }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[
        { label: "Total Clicks", value: data.totalClicks.toLocaleString() },
        { label: "Impressions", value: data.totalImpressions.toLocaleString() },
        { label: "Avg CTR", value: `${(data.avgCtr * 100).toFixed(2)}%` },
        { label: "Avg Position", value: data.avgPosition.toFixed(1) },
      ].map((m) => (
        <Card key={m.label}>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">{m.label}</p>
            <p className="text-2xl font-semibold mt-1">{m.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Create `src/components/search-console/gsc-chart.tsx`**

```tsx
"use client"

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts"
import type { DailyGscRow } from "@/types/search-console"

export function GscChart({ data }: { data: DailyGscRow[] }) {
  const formatted = data.map((d) => ({
    ...d,
    date: `${d.date.slice(5, 7)}/${d.date.slice(8, 10)}`,
  }))
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend />
        <Line yAxisId="left" type="monotone" dataKey="clicks" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Clicks" />
        <Line yAxisId="right" type="monotone" dataKey="impressions" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} dot={false} name="Impressions" />
      </LineChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 7: Create `src/components/search-console/position-buckets.tsx`**

```tsx
import type { PositionBuckets } from "@/types/search-console"

export function PositionBucketsChart({ data }: { data: PositionBuckets }) {
  const buckets = [
    { label: "Top 3", count: data.top3, color: "bg-green-500" },
    { label: "4–10", count: data.page1, color: "bg-blue-500" },
    { label: "11–20", count: data.page2, color: "bg-yellow-500" },
    { label: "21+", count: data.beyond, color: "bg-gray-400" },
  ]
  const total = buckets.reduce((s, b) => s + b.count, 0)
  return (
    <div className="space-y-2">
      {buckets.map((b) => (
        <div key={b.label} className="flex items-center gap-3">
          <span className="text-xs w-12 text-muted-foreground">{b.label}</span>
          <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
            <div
              className={`h-full ${b.color} rounded-full`}
              style={{ width: total > 0 ? `${(b.count / total) * 100}%` : "0%" }}
            />
          </div>
          <span className="text-xs w-8 text-right font-medium">{b.count}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 8: Create `src/components/search-console/top-queries-table.tsx`**

```tsx
import type { QueryRow } from "@/types/search-console"

export function TopQueriesTable({ data }: { data: QueryRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="text-left pb-2 font-medium">Query</th>
            <th className="text-right pb-2 font-medium">Clicks</th>
            <th className="text-right pb-2 font-medium">Impr.</th>
            <th className="text-right pb-2 font-medium">CTR</th>
            <th className="text-right pb-2 font-medium">Pos.</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 15).map((row, i) => (
            <tr key={i} className="border-b last:border-0">
              <td className="py-2 truncate max-w-[200px]">{row.query}</td>
              <td className="py-2 text-right">{row.clicks}</td>
              <td className="py-2 text-right">{row.impressions.toLocaleString()}</td>
              <td className="py-2 text-right">{(row.ctr * 100).toFixed(1)}%</td>
              <td className="py-2 text-right">{row.position.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 9: Create `src/app/domain/[id]/page.tsx`**

```tsx
import { notFound } from "next/navigation"
import { getDb } from "@/lib/db"
import { getDomain } from "@/lib/db/queries/domains"
import { getAnalyticsCache, getGscCache, getIssuesCache, getLastSyncedAt } from "@/lib/db/queries/cache"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MetricsOverview } from "@/components/analytics/metrics-overview"
import { TrafficChart } from "@/components/analytics/traffic-chart"
import { ChannelChart } from "@/components/analytics/channel-chart"
import { TopPagesTable } from "@/components/analytics/top-pages-table"
import { GscOverview } from "@/components/search-console/gsc-overview"
import { GscChart } from "@/components/search-console/gsc-chart"
import { PositionBucketsChart } from "@/components/search-console/position-buckets"
import { TopQueriesTable } from "@/components/search-console/top-queries-table"
import { IssuesTab } from "@/components/issues/issues-tab"
import { OpportunitiesTab } from "@/components/opportunities/opportunities-tab"
import { SyncButton } from "@/components/sync-button"
import type { AnalyticsReport } from "@/types/analytics"
import type { GscReport, IssuesReport } from "@/types/search-console"
import { computeOpportunities } from "@/lib/seo/opportunities"

export const dynamic = "force-dynamic"

export default async function DomainPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const domain = getDomain(db, Number(id))
  if (!domain) notFound()

  const analytics = getAnalyticsCache(db, domain.id, "1m") as AnalyticsReport | null
  const gsc = getGscCache(db, domain.id, "1m") as GscReport | null
  const issues = getIssuesCache(db, domain.id) as IssuesReport | null
  const lastSyncedAt = getLastSyncedAt(db, domain.id)
  const opportunities = gsc ? computeOpportunities(gsc.topQueries) : []

  const syncAgo = lastSyncedAt ? Math.round((Date.now() / 1000 - lastSyncedAt) / 3600) : null

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">{domain.hostname}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {syncAgo !== null ? `Last synced ${syncAgo}h ago` : "Never synced"}
          </p>
        </div>
        <SyncButton domainId={domain.id} />
      </div>

      <Tabs defaultValue="analytics">
        <TabsList className="mb-4">
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="search-console">Search Console</TabsTrigger>
          <TabsTrigger value="issues">Issues</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="space-y-4">
          {analytics ? (
            <>
              <MetricsOverview data={analytics.overview} />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="lg:col-span-2">
                  <CardHeader><CardTitle className="text-sm">Sessions over time</CardTitle></CardHeader>
                  <CardContent><TrafficChart data={analytics.daily} /></CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-sm">Traffic by channel</CardTitle></CardHeader>
                  <CardContent><ChannelChart data={analytics.channels} /></CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader><CardTitle className="text-sm">Top pages</CardTitle></CardHeader>
                <CardContent><TopPagesTable data={analytics.topPages} /></CardContent>
              </Card>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">No analytics data. Sync to load.</p>
          )}
        </TabsContent>

        <TabsContent value="search-console" className="space-y-4">
          {gsc ? (
            <>
              <GscOverview data={gsc.overview} />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="lg:col-span-2">
                  <CardHeader><CardTitle className="text-sm">Clicks &amp; Impressions</CardTitle></CardHeader>
                  <CardContent><GscChart data={gsc.daily} /></CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-sm">Keyword positions</CardTitle></CardHeader>
                  <CardContent><PositionBucketsChart data={gsc.positionBuckets} /></CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader><CardTitle className="text-sm">Top queries</CardTitle></CardHeader>
                <CardContent><TopQueriesTable data={gsc.topQueries} /></CardContent>
              </Card>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">No Search Console data. Sync to load.</p>
          )}
        </TabsContent>

        <TabsContent value="issues">
          <IssuesTab data={issues} />
        </TabsContent>

        <TabsContent value="opportunities">
          <OpportunitiesTab data={opportunities} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 10: Commit**

```bash
git add src/app/domain/ src/components/analytics/ src/components/search-console/
git commit -m "feat: add domain detail page with Analytics and Search Console tabs"
```

---

## Task 14: Issues and Opportunities Tabs

**Files:**
- Create: `src/components/issues/issues-tab.tsx`
- Create: `src/components/opportunities/opportunities-tab.tsx`

- [ ] **Step 1: Create `src/components/issues/issues-tab.tsx`**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { IssuesReport, CwvMetric } from "@/types/search-console"

function CwvBar({ label, metric }: { label: string; metric: CwvMetric | null }) {
  if (!metric) return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm">{label}</span>
      <span className="text-xs text-muted-foreground">No data</span>
    </div>
  )
  return (
    <div className="py-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">{label}</span>
        <div className="flex gap-2 text-xs">
          <span className="text-green-600">{metric.good}% good</span>
          <span className="text-yellow-600">{metric.needsImprovement}% needs work</span>
          <span className="text-red-600">{metric.poor}% poor</span>
        </div>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden">
        <div className="bg-green-500" style={{ width: `${metric.good}%` }} />
        <div className="bg-yellow-400" style={{ width: `${metric.needsImprovement}%` }} />
        <div className="bg-red-500" style={{ width: `${metric.poor}%` }} />
      </div>
    </div>
  )
}

export function IssuesTab({ data }: { data: IssuesReport | null }) {
  if (!data) return <p className="text-muted-foreground text-sm">No issues data. Sync to load.</p>

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Core Web Vitals</CardTitle></CardHeader>
        <CardContent className="divide-y">
          <CwvBar label="LCP (Largest Contentful Paint)" metric={data.cwv.lcp} />
          <CwvBar label="CLS (Cumulative Layout Shift)" metric={data.cwv.cls} />
          <CwvBar label="INP (Interaction to Next Paint)" metric={data.cwv.inp} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Sitemaps</CardTitle></CardHeader>
        <CardContent>
          {data.sitemaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sitemaps found in Search Console.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left pb-2 font-medium">Sitemap</th>
                  <th className="text-right pb-2 font-medium">Submitted</th>
                  <th className="text-right pb-2 font-medium">Indexed</th>
                  <th className="text-right pb-2 font-medium">Errors</th>
                  <th className="text-right pb-2 font-medium">Warnings</th>
                </tr>
              </thead>
              <tbody>
                {data.sitemaps.map((sm, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 font-mono text-xs truncate max-w-[200px]">{sm.path}</td>
                    <td className="py-2 text-right">{sm.submitted}</td>
                    <td className="py-2 text-right">{sm.indexed}</td>
                    <td className="py-2 text-right">
                      {sm.errors > 0 ? <Badge variant="destructive">{sm.errors}</Badge> : "0"}
                    </td>
                    <td className="py-2 text-right">
                      {sm.warnings > 0 ? <Badge variant="outline" className="text-yellow-600">{sm.warnings}</Badge> : "0"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/opportunities/opportunities-tab.tsx`**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { OpportunityRow } from "@/lib/seo/opportunities"

export function OpportunitiesTab({ data }: { data: OpportunityRow[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground text-sm">
          No opportunities found. You may need more GSC data or all keywords are already optimized.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Quick-win keywords</CardTitle>
        <p className="text-xs text-muted-foreground">
          Keywords ranking 4–20 with high impressions and below-average CTR
        </p>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="text-left pb-2 font-medium">Keyword</th>
              <th className="text-right pb-2 font-medium">Pos.</th>
              <th className="text-right pb-2 font-medium">Impr.</th>
              <th className="text-right pb-2 font-medium">CTR</th>
              <th className="text-right pb-2 font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="py-2">{row.query}</td>
                <td className="py-2 text-right">{row.position.toFixed(1)}</td>
                <td className="py-2 text-right">{row.impressions.toLocaleString()}</td>
                <td className="py-2 text-right">{(row.ctr * 100).toFixed(1)}%</td>
                <td className="py-2 text-right font-medium">{row.opportunityScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/issues/ src/components/opportunities/
git commit -m "feat: add Issues (CWV + sitemaps) and Opportunities tabs"
```

---

## Task 15: Settings Page

**Files:**
- Create: `src/app/settings/page.tsx`

- [ ] **Step 1: Create `src/app/settings/page.tsx`**

```tsx
"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Plus, Trash2, ExternalLink } from "lucide-react"

interface Domain {
  id: number
  hostname: string
  ga4_property_id: string | null
  gsc_site_url: string | null
  created_at: number
}

interface DiscoveryResult {
  ga4Properties: { id: string; displayName: string }[]
  gscSites: { siteUrl: string }[]
}

export default function SettingsPage() {
  const [domains, setDomains] = useState<Domain[]>([])
  const [newHostname, setNewHostname] = useState("")
  const [adding, setAdding] = useState(false)
  const [discovering, setDiscovering] = useState<number | null>(null)
  const [discoveryResult, setDiscoveryResult] = useState<{ domainId: number; result: DiscoveryResult } | null>(null)

  async function loadDomains() {
    const res = await fetch("/api/domains")
    setDomains(await res.json())
  }

  useEffect(() => { loadDomains() }, [])

  async function addDomain() {
    if (!newHostname.trim()) return
    setAdding(true)
    await fetch("/api/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostname: newHostname.trim() }),
    })
    setNewHostname("")
    setAdding(false)
    loadDomains()
  }

  async function deleteDomain(id: number) {
    if (!confirm("Delete this domain and all its data?")) return
    await fetch(`/api/domains/${id}`, { method: "DELETE" })
    loadDomains()
  }

  async function discoverProperties(domainId: number) {
    setDiscovering(domainId)
    const res = await fetch(`/api/domains/${domainId}/discover`)
    if (res.ok) setDiscoveryResult({ domainId, result: await res.json() })
    else alert("Discovery failed — make sure Google account is connected")
    setDiscovering(null)
  }

  async function applyDiscovery(domainId: number, ga4PropertyId: string, gscSiteUrl: string) {
    await fetch(`/api/domains/${domainId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ga4PropertyId, gscSiteUrl }),
    })
    setDiscoveryResult(null)
    loadDomains()
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      {/* Google OAuth */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Google Account</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect your Google account to access Google Analytics and Search Console data.
          </p>
          <a href="/api/auth/google">
            <Button size="sm">
              <ExternalLink className="w-3 h-3 mr-1.5" />
              Connect / Re-authorize Google Account
            </Button>
          </a>
        </CardContent>
      </Card>

      <Separator />

      {/* Domain Management */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Domains</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <input
              className="flex-1 border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="example.com"
              value={newHostname}
              onChange={(e) => setNewHostname(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addDomain()}
            />
            <Button size="sm" onClick={addDomain} disabled={adding}>
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>

          <div className="space-y-2">
            {domains.map((domain) => (
              <div key={domain.id} className="border rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{domain.hostname}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => discoverProperties(domain.id)}
                      disabled={discovering === domain.id}
                    >
                      {discovering === domain.id ? "Discovering…" : "Discover properties"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteDomain(domain.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2 text-xs">
                  <Badge variant={domain.ga4_property_id ? "default" : "outline"}>
                    GA4: {domain.ga4_property_id ?? "not linked"}
                  </Badge>
                  <Badge variant={domain.gsc_site_url ? "default" : "outline"}>
                    GSC: {domain.gsc_site_url ? "linked" : "not linked"}
                  </Badge>
                </div>

                {/* Discovery result for this domain */}
                {discoveryResult?.domainId === domain.id && (
                  <div className="bg-muted rounded-md p-3 space-y-2 text-xs">
                    <p className="font-medium">Select properties to link:</p>
                    {discoveryResult.result.ga4Properties.length === 0 && (
                      <p className="text-muted-foreground">No GA4 properties found. <a href="https://analytics.google.com" target="_blank" className="underline">Create one →</a></p>
                    )}
                    {discoveryResult.result.ga4Properties.map((prop) => (
                      <div key={prop.id} className="flex items-center justify-between">
                        <span>{prop.displayName} ({prop.id})</span>
                        {discoveryResult.result.gscSites.map((site) => (
                          <Button
                            key={site.siteUrl}
                            size="sm"
                            variant="outline"
                            className="h-6 text-xs"
                            onClick={() => applyDiscovery(domain.id, prop.id, site.siteUrl)}
                          >
                            Link GA4 + {site.siteUrl}
                          </Button>
                        ))}
                      </div>
                    ))}
                    {discoveryResult.result.gscSites.length === 0 && (
                      <p className="text-muted-foreground">No matching GSC sites. <a href="https://search.google.com/search-console" target="_blank" className="underline">Add site →</a></p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/settings/
git commit -m "feat: add settings page with OAuth connect, domain management, and property discovery"
```

---

## Task 16: Startup Sync Integration

**Files:**
- Create: `src/components/startup-sync.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create `src/components/startup-sync.tsx`**

```tsx
"use client"

import { useEffect } from "react"

export function StartupSync() {
  useEffect(() => {
    // Fire-and-forget — server checks staleness and only syncs if needed
    fetch("/api/sync/startup", { method: "POST" }).catch(console.error)
  }, [])
  return null
}
```

- [ ] **Step 2: Add `StartupSync` to `src/app/layout.tsx`**

Add import and usage inside `<body>`:
```tsx
import { StartupSync } from "@/components/startup-sync"

// Inside <body>:
<body className={inter.className}>
  <StartupSync />
  <div className="flex min-h-screen">
    <Sidebar />
    <main className="flex-1 p-6 bg-muted/20">{children}</main>
  </div>
</body>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/startup-sync.tsx src/app/layout.tsx
git commit -m "feat: trigger startup sync on app load"
```

---

## Task 17: Docker Setup

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.dockerignore`

- [ ] **Step 1: Create `Dockerfile`**

```dockerfile
FROM oven/bun:1.1 AS builder
WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1.1-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
RUN mkdir -p /app/data
EXPOSE 3000
ENV DB_PATH=/app/data/analytics.db
CMD ["bun", "server.js"]
```

- [ ] **Step 2: Update `next.config.ts` to enable standalone output**

```typescript
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
}

export default nextConfig
```

- [ ] **Step 3: Create `docker-compose.yml`**

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - analytics_data:/app/data
    env_file:
      - .env
    restart: unless-stopped

volumes:
  analytics_data:
```

- [ ] **Step 4: Create `.dockerignore`**

```
node_modules
.next
.git
data/
.env
.env.local
```

- [ ] **Step 5: Test Docker build**

```bash
docker compose build
docker compose up
```
Open `http://localhost:3000` — dashboard should load.

- [ ] **Step 6: Commit**

```bash
git add Dockerfile docker-compose.yml .dockerignore next.config.ts
git commit -m "feat: add Docker + Docker Compose setup with persistent SQLite volume"
```

---

## Task 18: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

````markdown
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
2. Enable these APIs (APIs & Services → Library):
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
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback` (add your VPS URL too if deploying)
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

### 3. Run with Docker

```bash
docker compose up --build
```

Open `http://localhost:3000`

### 4. Connect Google Account

1. Go to **Settings** → click **Connect Google Account**
2. Authorize all requested permissions
3. You'll be redirected back to Settings

### 5. Add a Domain

1. Settings → enter `yourdomain.com` → click **Add**
2. Click **Discover properties** — the app will find your GA4 and GSC accounts
3. Click **Link** to connect them
4. Click **Sync** to load the first data pull

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

1. Push this repo to your VPS
2. Update `.env`: set `NEXT_PUBLIC_APP_URL` to your domain/IP
3. Add the VPS URL to Google Cloud Console authorized redirect URIs
4. Run `docker compose up -d --build`
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with Google Cloud setup and usage instructions"
```

---

## Self-Review

### Spec Coverage Check

| Requirement | Task |
|---|---|
| Single-user tool | Architecture — no auth layer |
| Bun runtime | Task 1 |
| Next.js + TypeScript | Task 1 |
| Docker Compose + SQLite volume | Task 17 |
| Google OAuth persistent tokens | Tasks 3, 4 |
| GA4 integration | Task 5 |
| GSC integration | Task 6 |
| CrUX (CWV) integration | Task 6 |
| Domain auto-discovery | Task 9 |
| Startup sync (stale check) | Tasks 8, 16 |
| Manual sync button | Tasks 8, 11 |
| Date ranges: Today/Yesterday/7d/1m/90d/1y | Tasks 8, 11 |
| Dashboard with domain cards | Task 12 |
| GA4 metrics: sessions, users, pageviews, bounce, duration, channels, top pages | Tasks 5, 13 |
| GSC metrics: clicks, impressions, CTR, position, top queries, top pages, position buckets | Tasks 6, 13 |
| Issues: sitemap errors/warnings | Task 6 |
| Issues: Core Web Vitals (LCP, CLS, INP) | Task 6 |
| Issues tab grouped by type with severity | Task 14 |
| SEO opportunities (position 4-20, auto-threshold) | Tasks 7, 14 |
| Settings: OAuth connect, domain management, sync | Task 15 |
| shadcn/ui + Tailwind + Recharts | Tasks 1, 13 |
| README with Google Cloud setup guide | Task 18 |

**No gaps found.**

### Placeholder Scan

No TBDs, no "add appropriate" language, no "similar to" references. All steps include complete code.

### Type Consistency Check

- `AnalyticsReport`, `AnalyticsOverview`, `DailyRow`, `ChannelRow`, `PageRow` — defined in Task 5 (`src/types/analytics.ts`), used in Tasks 12, 13 ✓
- `GscReport`, `GscOverview`, `QueryRow`, `GscPageRow`, `DailyGscRow`, `PositionBuckets`, `IssuesReport`, `CwvMetric`, `SitemapInfo` — defined in Task 6 (`src/types/search-console.ts`), used in Tasks 13, 14, 15 ✓
- `OpportunityRow` — defined in Task 7 (`src/lib/seo/opportunities.ts`), used in Task 14 ✓
- `Domain` interface in `src/types/domain.ts` (Task 4) matches `src/lib/db/queries/domains.ts` shape — note the DB layer uses `snake_case` column names, the API returns them as-is. Settings page (Task 15) correctly references `domain.ga4_property_id` and `domain.gsc_site_url` in snake_case matching the DB row. ✓
- `discoverProperties()` defined in Task 6 (`search-console.ts`), called in Task 9 (discover route) ✓
- `syncDomain()` and `startupSync()` defined in Task 8, called in Tasks 8 (API routes) and 16 (startup) ✓
- `computeOpportunities()` defined in Task 7, called in Task 10 (issues route) and Task 13 (domain page) ✓
