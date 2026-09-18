// Plain CommonJS on purpose -- do NOT convert back to next.config.ts.
// The production host (Hostinger) runs glibc < 2.29, so @next/swc-linux-x64-gnu
// fails to load and Next falls back to the WASM SWC bindings. That fallback
// botches the next.config.ts transpile step, emitting an extensionless temp
// file and dying with:
//   Cannot find module '/.../<hash>.next.config' imported from next.config.compiled.js
// A .js config needs no transpile, so it loads on the WASM path. Keeping this
// CJS (package.json has no "type": "module") also keeps __dirname available.

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Pin the file-tracing root to this project. A stray pnpm-lock.yaml in the
  // parent dir (C:\dev\projects) makes Next.js infer the wrong workspace root.
  // Under Turbopack that broke the middleware manifest; under webpack it skews
  // which files get copied into .next/standalone. Anchor both explicitly.
  outputFileTracingRoot: __dirname,
  // Local `next dev` still uses Turbopack (native bindings exist on Windows),
  // so this pin stays relevant for dev even though `build` runs webpack.
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
  // Keep prefetched / just-visited *dynamic* route segments in the client
  // router cache for a short window. The default is 0s, so navigating back to
  // a section re-issues a full RSC render every time — a steady CPU drain on
  // this dashboard, whose data only changes on sync (≤ once/day). 30s lets the
  // client reuse a segment within a browsing session. Tradeoff: a revisited
  // section can show data up to 30s stale before the next refresh.
  experimental: {
    staleTimes: {
      dynamic: 30,
    },
  },
}

module.exports = nextConfig
