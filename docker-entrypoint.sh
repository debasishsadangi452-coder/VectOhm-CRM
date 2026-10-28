#!/bin/sh
# Starts the three processes that make up the container and ties their
# lifetimes together: if any one exits, the whole container exits so Railway
# restarts it rather than leaving a half-dead service serving errors.
set -eu

: "${PORT:=8080}"
: "${API_PORT:=4001}"
: "${WEB_PORT:=3000}"

if [ -z "${DATABASE_URL:-}" ]; then
	echo "WARNING: DATABASE_URL is not set in Railway variables." >&2
	echo "         Please attach a Postgres plugin: DATABASE_URL=\${{Postgres.DATABASE_URL}}" >&2
fi

# Secrets must come from Railway variables. There are deliberately no hard-coded fallbacks: a default
# written in the repo would let anyone forge login tokens or decrypt stored credentials.
# JWT_SECRET alone is enough: it is used for whichever of the access/refresh secrets is unset.
JWT_ACCESS_SECRET="${JWT_ACCESS_SECRET:-${JWT_SECRET:-}}"
JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-${JWT_SECRET:-}}"
: "${JWT_ACCESS_SECRET:?Set JWT_ACCESS_SECRET (or JWT_SECRET) in Railway variables. Refusing to start.}"
: "${JWT_REFRESH_SECRET:?Set JWT_REFRESH_SECRET (or JWT_SECRET) in Railway variables. Refusing to start.}"
: "${APP_ENCRYPTION_KEY:?APP_ENCRYPTION_KEY is not set in Railway variables. Refusing to start.}"
export JWT_ACCESS_SECRET JWT_REFRESH_SECRET APP_ENCRYPTION_KEY

# Public URL: derived from the domain Railway assigns, so APP_URL / CORS_ORIGIN / OAUTH_REDIRECT_BASE_URL
# need no configuration (set any of them explicitly to override). Same-origin requests through Caddy
# are also accepted by the API without any of these.
if [ -z "${APP_URL:-}" ]; then
	if [ -n "${RAILWAY_PUBLIC_DOMAIN:-}" ]; then
		APP_URL="https://$RAILWAY_PUBLIC_DOMAIN"
	else
		APP_URL="http://localhost:$PORT"
	fi
fi
export APP_URL
export CORS_ORIGIN="${CORS_ORIGIN:-$APP_URL}"
# Mailbox OAuth callbacks hit the API, which Caddy serves under /api.
export OAUTH_REDIRECT_BASE_URL="${OAUTH_REDIRECT_BASE_URL:-$APP_URL/api}"

echo "==> Applying database migrations"
cd /app/server
# A failed migration must stop the deploy (Railway then keeps the previous version running).
# Never fall back to `db push --accept-data-loss`: it can drop columns or tables.
./node_modules/.bin/prisma migrate deploy

pids=""
terminating=""

terminate() {
	# Guard so the EXIT trap firing after a signal does not run this twice.
	[ -n "$terminating" ] && return
	terminating=1
	for pid in $pids; do
		kill -TERM "$pid" 2>/dev/null || true
	done
	wait 2>/dev/null || true
}

trap terminate TERM INT
trap terminate EXIT

echo "==> Starting NestJS API on 127.0.0.1:$API_PORT"
cd /app/server
PORT="$API_PORT" node dist/main.js &
pids="$pids $!"

echo "==> Starting TanStack Start SSR server on 127.0.0.1:$WEB_PORT"
cd /app/web
# Bind to loopback: only Caddy should reach this directly.
PORT="$WEB_PORT" HOST=127.0.0.1 node .output/server/index.mjs &
pids="$pids $!"

echo "==> Starting Caddy on :$PORT"
caddy run --config /etc/caddy/Caddyfile --adapter caddyfile &
pids="$pids $!"

# Block until the first process exits, then tear the rest down. `wait -n`
# is not in POSIX sh, so poll instead.
while true; do
	for pid in $pids; do
		if ! kill -0 "$pid" 2>/dev/null; then
			echo "==> Process $pid exited; shutting down container" >&2
			exit 1
		fi
	done
	sleep 2
done
