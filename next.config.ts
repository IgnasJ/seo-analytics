import type { NextConfig } from "next"
import path from "path"

const shimPath = path
  .resolve("./src/lib/bun-sqlite-shim.js")
  .replace(/\\/g, "/")

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    resolveAlias: {
      "bun:sqlite": shimPath,
    },
  },
  webpack: (config) => {
    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "bun:sqlite": shimPath,
    }
    return config
  },
}

export default nextConfig
