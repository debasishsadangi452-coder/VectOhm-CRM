# Running OmniOS locally

Two independent processes: the frontend (root of the repo) and the backend
(`server/`), plus a Postgres container the backend depends on.

## Prerequisites (one-time)

- [Bun](https://bun.sh) — package manager + runtime for both frontend and backend.
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — runs Postgres.
  On Windows this needs the WSL2 backend (`wsl --install --no-distribution`
  from an elevated PowerShell, then reboot, if WSL2 isn't already enabled).
- `server/.env` — copy `server/.env.example` to `server/.env` and fill in real
  secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `APP_ENCRYPTION_KEY`,
  `GITHUB_WEBHOOK_SECRET`). Generate random hex values with:
  ```
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
  `DATABASE_URL` in the example already matches `server/docker-compose.yml`
  (`omnios`/`omnios` on port 5433) — no change needed there for local dev.
  `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`MICROSOFT_CLIENT_ID`/
  `MICROSOFT_CLIENT_SECRET` (mailbox OAuth connect) are optional — the app
  runs fine without them, "Connect with Google/Outlook" just shows as
  unavailable until they're set.

Install dependencies once (and again after pulling changes that touch
`package.json`):
```
bun install              # from repo root, installs frontend deps
cd server && bun install # installs backend deps
```

## Start everything (day to day)

```
# 1. Postgres (Docker Desktop must already be running)
cd server
docker compose up -d

# 2. Backend — http://localhost:4001
bun run start:dev

# 3. Frontend — http://localhost:8080 (from repo root, separate terminal)
cd ..
bun run dev
```

Both `start:dev` and `dev` run in watch mode, so code edits hot-reload. Use
the plain `bun run start` (no watch) instead of `start:dev` for a one-shot
boot, e.g. to confirm the app still starts cleanly after a schema change.

Check the backend is actually talking to the database:
```
curl http://localhost:4001/health
# {"status":"ok","db":"ok"}
```

## First-time database setup

Only needed once per fresh Postgres volume (e.g. right after `docker compose
up -d` for the first time):
```
cd server
bun run prisma generate       # generates the Prisma client
bun run prisma migrate deploy # applies all migrations
bun run prisma:seed           # resets to known-good seed data + 10 test users
```
`prisma:seed` prints the seeded accounts and their (shared, dev-only)
password to the console — don't paste that output into anything that gets
committed.

## Stopping

- Frontend / backend: `Ctrl+C` in their terminal.
- Postgres: `docker compose down` (from `server/`) stops the container but
  keeps the data volume; add `-v` to also wipe the volume.

## Troubleshooting

- **`bun: command not found`** — Bun's installer updates `PATH`, but an
  already-open shell won't see it until restarted.
- **Backend can't reach Postgres (`P1001` / "Can't reach database server")**
  — confirm the container is up and healthy:
  `docker ps --filter name=postgres` should show `(healthy)`. Two distinct
  failure modes here, don't confuse them:
  - *Docker Desktop itself isn't running* — `docker ps` errors with something
    like "check if the daemon is running" rather than returning a table.
    Start Docker Desktop and wait ~30-60s for the daemon to come up.
  - *Docker Desktop is running but the container isn't* — this project's
    container is named `server-postgres-1` (from `docker compose`'s
    `<folder>-<service>-<n>` naming). If Docker Desktop was fully quit (not
    just its window closed) and later reopened, this container does **not**
    always auto-start with it. Check with
    `docker ps -a --filter name=server-postgres` — if it shows `Exited`,
    run `docker start server-postgres-1` (or `docker compose up -d` from
    `server/`, which does the same thing).
  - If Docker Desktop itself won't start at all, it usually means WSL2 isn't
    enabled yet (see Prerequisites).
- **Backend fails to (re)start with `EADDRINUSE :::4001`** — a previous
  backend process is still holding the port (common if a terminal/task was
  killed rather than stopped cleanly). Find and stop it:
  ```
  # PowerShell
  $procId = (Get-NetTCPConnection -LocalPort 4001 -State Listen).OwningProcess
  Stop-Process -Id $procId -Force
  ```
- **`prisma generate` fails with `EPERM: operation not permitted, rename ...
  query_engine-windows.dll.node`** — on Windows, a running backend process
  has the current Prisma query engine file locked. Stop the backend first
  (see the `EADDRINUSE` fix above to find its PID), then re-run
  `prisma generate`, then restart the backend.
- **CORS / login redirect issues** — `CORS_ORIGIN` and `APP_URL` in
  `server/.env` must match the frontend's actual origin
  (`http://localhost:8080` by default; Vite auto-picks a different port if
  8080 is taken, in which case update both).

## Deploying to Railway

One service built from the root `Dockerfile` plus the Postgres plugin. Required variables:

```
DATABASE_URL=${{Postgres.DATABASE_PRIVATE_URL}}
JWT_SECRET=<random>            # or set JWT_ACCESS_SECRET / JWT_REFRESH_SECRET separately
APP_ENCRYPTION_KEY=<64 hex chars>
ADMIN_EMAIL=...                # initial admin, created on first boot if it doesn't exist
ADMIN_PASSWORD=...
ADMIN_NAME=Admin               # optional
```

`APP_URL`, `CORS_ORIGIN` and `OAUTH_REDIRECT_BASE_URL` are derived from the Railway public domain
(and the API accepts same-origin requests regardless), so leave them unset. Migrations run on every
start. The admin is only created when no user with that email exists, so changing `ADMIN_PASSWORD`
later does not reset the password — change it in the app. Do not run `prisma:seed` in production: it
wipes the database.
