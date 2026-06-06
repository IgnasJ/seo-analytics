import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  // Pin the Turbopack root to this project. A stray pnpm-lock.yaml in the
  // parent dir (C:\dev\projects) made Next.js infer the wrong workspace root,
  // which compiled proxy.ts under `[project]/analytics/src/proxy.ts` but left
  // it out of the middleware manifest -> "Cannot find the middleware module"
  // and 404s on every route. Anchoring the root here fixes module resolution.
  turbopack: {
    root: __dirname,
  },
  // Position the Next.js dev-mode route indicator on the right edge.
  // Default is bottom-left.
  devIndicators: {
    position: "bottom-right",
  },
  // Whitelist the local-network IPs we open the dev server from on phones /
  // tablets. Without this, Next.js 16 blocks HMR over LAN with:
  //   "Blocked cross-origin request to Next.js dev resource /_next/...
  //    from '192.168.x.x'."
  // Edit this list if your machine's LAN IP changes.
  allowedDevOrigins: ["172.31.96.1"],
  // Type-checking runs locally / in CI, not during the Docker production
  // build. Bun's partial worker_threads support deadlocks tsc here.
  typescript: { ignoreBuildErrors: true },
  // better-sqlite3 is a native Node addon — keep it external so Next.js
  // doesn't try to bundle the .node binary. (It's also in Next.js's default
  // auto-externalize list, but listing it here is explicit and future-proof.)
  serverExternalPackages: ["better-sqlite3"],
}

export default nextConfig
