import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
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
  allowedDevOrigins: ["192.168.0.135"],
  // Type-checking runs locally / in CI, not during the Docker production
  // build. Bun's partial worker_threads support deadlocks tsc here.
  typescript: { ignoreBuildErrors: true },
  // better-sqlite3 is a native Node addon — keep it external so Next.js
  // doesn't try to bundle the .node binary. (It's also in Next.js's default
  // auto-externalize list, but listing it here is explicit and future-proof.)
  serverExternalPackages: ["better-sqlite3"],
}

export default nextConfig
