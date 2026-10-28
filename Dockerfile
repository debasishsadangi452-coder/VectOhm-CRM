# syntax=docker/dockerfile:1

# Single-container deploy for Railway: Caddy fronts two Node processes.
#   $PORT (Railway-assigned) -> Caddy
#     /api/*  -> NestJS API on 127.0.0.1:4001 (prefix stripped)
#     /*      -> TanStack Start SSR server on 127.0.0.1:3000
#
# The frontend calls the API at the relative path /api (VITE_API_URL below), so
# the browser talks to one origin and CORS never comes into play.

# ---------------------------------------------------------------------------
# Stage 1a - production dependencies for the API, with the Prisma client
# generated once. Separate from the build stage so BuildKit runs the two in
# parallel and a source-only change never re-installs these.
# (bun: server/ is locked with bun.lock, and @nestjs/jwt@10 declares a peer
# range that excludes NestJS 11, which npm refuses to install without
# --legacy-peer-deps)
# ---------------------------------------------------------------------------
FROM oven/bun:1.3.14-debian AS api-deps
WORKDIR /build/server

# openssl is required by Prisma's engine detection during `prisma generate`.
RUN apt-get update     && apt-get install -y --no-install-recommends openssl ca-certificates     && rm -rf /var/lib/apt/lists/*

COPY server/package.json server/bun.lock ./
RUN bun install --production

# `prisma` is a runtime dependency (the entrypoint runs `migrate deploy`), so the
# CLI is present in this production install.
COPY server/prisma ./prisma
RUN bunx prisma generate

# ---------------------------------------------------------------------------
# Stage 1b - compile the NestJS API (needs dev dependencies for tsc/nest)
# ---------------------------------------------------------------------------
FROM oven/bun:1.3.14-debian AS api-build
WORKDIR /build/server

# openssl is required by Prisma's engine detection during `prisma generate`.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY server/package.json server/bun.lock ./
RUN bun install

# Generate the Prisma client before compiling: Nest's build type-checks against
# the generated @prisma/client types.
COPY server/prisma ./prisma
RUN bunx prisma generate

COPY server/tsconfig.json server/tsconfig.build.json server/nest-cli.json ./
COPY server/src ./src
RUN bun run build

# ---------------------------------------------------------------------------
# Stage 2 - build the TanStack Start frontend
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS web-build
WORKDIR /build

# node-server emits a plain Node server at .output/server/index.mjs. Without
# this the build defaults to the cloudflare-module preset, which produces a
# Worker bundle that cannot run here.
ENV NITRO_PRESET=node-server

# Baked in at build time by Vite. Relative path == same origin as the page,
# so it works for any Railway domain without rebuilding.
ENV VITE_API_URL=/api

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts components.json ./
COPY public ./public
COPY src ./src
RUN npm run build
# No `npm prune` / node_modules copy: Nitro bundles and traces what the server needs
# into .output, so the runtime stage only takes .output.

# ---------------------------------------------------------------------------
# Stage 3 - runtime
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production

# caddy   - reverse proxy on $PORT
# tini    - PID 1 that reaps zombies and forwards signals
# openssl - required by the Prisma query engine at runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        caddy \
        tini \
        openssl \
        ca-certificates \
        curl \
    && rm -rf /var/lib/apt/lists/*

# --- API ---
COPY --from=api-deps /build/server/node_modules ./server/node_modules
COPY --from=api-build /build/server/dist ./server/dist
COPY --from=api-deps /build/server/package.json ./server/package.json
# prisma/ ships so `prisma migrate deploy` can run at startup.
COPY --from=api-deps /build/server/prisma ./server/prisma
# One-off volume -> Bunny copy for pre-Bunny screen recordings; run by hand
# with `railway ssh` (see the script's header).
COPY server/scripts/migrate-recordings-to-bunny.mjs ./server/scripts/migrate-recordings-to-bunny.mjs

# --- Frontend ---
COPY --from=web-build /build/package.json ./web/package.json
COPY --from=web-build /build/.output ./web/.output

COPY Caddyfile /etc/caddy/Caddyfile
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Internal ports. Only $PORT (Caddy) is exposed to Railway.
ENV API_PORT=4001 \
    WEB_PORT=3000 \
    PORT=8080

# Run as non-root. Caddy binds $PORT (>1024), so no privileged bind is needed.
RUN useradd --system --create-home --uid 10001 app \
    && mkdir -p /data/caddy /config/caddy \
    && chown -R app:app /app /data/caddy /config/caddy
USER app

# Caddy writes its state here; without these it tries to use / and fails.
ENV XDG_DATA_HOME=/data \
    XDG_CONFIG_HOME=/config

EXPOSE 8080

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
