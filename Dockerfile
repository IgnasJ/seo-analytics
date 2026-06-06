FROM node:22-slim AS builder
WORKDIR /app

# Install pnpm via corepack (bundled with Node 22).
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate

# pnpm-workspace.yaml carries the `allowBuilds` decisions; without it pnpm 11
# aborts on undecided dependency build scripts (sharp/msw).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build


FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Standalone bundles the app and its production dependencies into
# .next/standalone, so no pnpm install is needed at runtime. SQLite is provided
# by Node's built-in `node:sqlite` module (Node 22+), so there's no native addon
# or build toolchain to carry into the image.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

RUN mkdir -p /app/data
ENV DB_PATH=/app/data/analytics.db
EXPOSE 3000

CMD ["node", "server.js"]
