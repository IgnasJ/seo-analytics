import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  // Position the Next.js dev-mode route indicator on the right edge.
  // Default is bottom-left.
  devIndicators: {
    position: "bottom-right",
  },
  // Type-checking runs locally / in CI, not during the Docker production
  // build. Bun's partial worker_threads support deadlocks tsc here.
  typescript: { ignoreBuildErrors: true },
  // better-sqlite3 is a native Node addon — keep it external so Next.js
  // doesn't try to bundle the .node binary. (It's also in Next.js's default
  // auto-externalize list, but listing it here is explicit and future-proof.)
  serverExternalPackages: ["better-sqlite3"],
}

export default nextConfig
