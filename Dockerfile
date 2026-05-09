FROM node:20-slim AS builder
WORKDIR /app

# Install pnpm via corepack (bundled with Node 20).
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

# Build tools needed only if better-sqlite3's prebuilt binary is missing for
# this platform. Removed in the runner stage.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build


FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Standalone bundles all production dependencies (including the native
# better-sqlite3 .node binary) into .next/standalone, so no pnpm install needed
# at runtime.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

RUN mkdir -p /app/data
ENV DB_PATH=/app/data/analytics.db
EXPOSE 3000

CMD ["node", "server.js"]
