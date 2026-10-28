# Sales Email Automation — setup after pulling

This covers what's needed to get the new Apollo/Templates/Sequences
feature (`/outreach`) working on a machine that just pulled this branch,
beyond the general dev setup already covered in `RUNNING.md`.

## 1. Pull in the new code

```
git pull
```

## 2. Install dependencies

`server/package.json` picked up a new dependency (`@nestjs/schedule`, the
job scheduler that drives sequence sends):

```
bun install              # from repo root
cd server && bun install
```

## 3. Apply the new migrations

Five new migrations ship in this branch (Apollo integration, email
templates, email suppression, sequences, and a follow-up FK fix). With
Postgres running (`docker compose up -d` from `server/`):

```
cd server
bun run prisma generate
bun run prisma migrate deploy
```

## 4. Confirm `APP_ENCRYPTION_KEY` is set

`server/.env` needs `APP_ENCRYPTION_KEY` (32-byte hex) — it's not new to
this feature, but Apollo's stored API key and the unsubscribe-link
signing both depend on it. If this machine's `server/.env` doesn't
already have one:

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Put the result in `server/.env` as `APP_ENCRYPTION_KEY=...`. (If you're
pointing at a *different* local Postgres than the one Apollo was
originally connected on, you'll need to reconnect Apollo here regardless
— see below — so this key doesn't need to match any other machine's.)

## 5. Add the Resend key (the part you're doing separately)

In `server/.env`:

```
RESEND_API_KEY="re_..."
MAIL_FROM="Your Sales Team <outreach@yourverifieddomain.com>"
```

Notes:
- `MAIL_FROM`'s address must be on a domain you've verified in Resend
  (Domains → Add Domain → add the SPF/DKIM records at your registrar).
  Until that's done, or as a quick test, you can leave `MAIL_FROM` unset
  to fall back to `OmniOS <onboarding@resend.dev>` — fine for a test
  send to yourself, not for real prospects.
- Without `RESEND_API_KEY` (or `SENDGRID_API_KEY`) set, the app runs in
  its existing dev fallback: emails aren't sent, just logged to the
  backend console. That's how this feature was built and tested on this
  machine — nothing breaks by leaving it unset, sequences just won't
  actually deliver.
- Restart the backend (`bun run start:dev`) after editing `.env` —
  it's not hot-reloaded.

## 6. Reconnect Apollo on this machine

The Apollo API key isn't in `.env` — it's stored encrypted in the
database via the app itself. If this machine has its own local Postgres
(the normal setup per `RUNNING.md`), it starts with no Apollo connection
even though this one does. Reconnect it:

1. Log in as an Admin user.
2. `/admin/settings` → "Apollo.io Connection" → paste the API key →
   Connect. It's validated against Apollo live before being saved.

## 7. Verify it's working

```
curl http://localhost:4001/health
```

Then in the app: `/outreach` should load with all four tabs (Find
People, Find Companies, Templates, Sequences) plus Activity once a
sequence exists. Create a template, a one-step sequence, enroll a test
contact with an email you control, and either wait for the engine's
5-minute tick or (as Admin) trigger it immediately:

```
curl -X POST http://localhost:4001/sequences/engine/run \
  -H "Authorization: Bearer <admin access token>"
```

Check the backend console (no provider configured) or your inbox (once
`RESEND_API_KEY` is set) for the result.
