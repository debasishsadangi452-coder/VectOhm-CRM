# Engagement Intelligence — Phase 4 (Deep Integration)

## Status

Phases 1-3 of the Engagement Intelligence & Follow-Up Automation System are
**done, merged into `main`, and verified live** (not just typechecked —
tested through the real API with a browser open, watching updates land with
no page refresh). This doc is the handoff for whoever picks up **Phase 4**,
the last phase of the original plan.

Original full plan (context/history) is not reproduced here — this file is
self-contained for Phase 4 specifically. Read the "What already exists"
section below before writing any code; almost everything Phase 4 needs is
already built and just needs wiring.

---

## What already exists (Phases 1-3)

### Phase 1 — Event foundation, scoring, tracking
- `server/prisma/schema.prisma`: `EngagementEvent` model (14 event types),
  `Contact.engagementScore`/`engagementTier` (cached, band-derived), click
  columns + `providerMessageId`/`threadId` on `BulkEmailRecipient` and
  `SequenceSend` (added in Phase 1, **unpopulated until now** — this is
  exactly what Phase 4's reply-detection needs).
- `server/src/modules/engagement/` — `EngagementEventsService.record()` is
  the one call site every emitter uses; `EngagementScoreService` for the
  score/tier math.
- `server/src/modules/tracking/tracking.controller.ts` — open + click
  tracking, both `/tracking/open/*` and `/tracking/click/*`, bulk and
  sequence variants.
- `src/components/engagement-badge.tsx` — the Cold/Warm/Hot/Sales-Ready pill,
  already used on the Contact sheet and Deal detail page.

### Phase 2 — Follow-Up Automation
- `FollowUpTask` model, `FollowUpMode` (Manual/Assisted/Automated) on
  `Sequence`/`BulkEmailCampaign` (opt-in, defaults to Manual).
- `server/src/modules/follow-ups/` — `FollowUpAutomationService` (30-min
  cron), `FollowUpAiService` (Anthropic SDK + simulated fallback, same
  pattern as `seo-content-briefs.service.ts`), `FollowUpTasksController`
  (`GET /follow-ups`, `POST /follow-ups/:id/generate-draft`,
  `POST /follow-ups/:id/send`, `PATCH /follow-ups/:id/dismiss`,
  `POST /follow-ups/engine/run`).

### Phase 3 — Real-time + Engagement Center
- `server/src/modules/notifications/notifications.gateway.ts` — first-ever
  WebSocket infra in this codebase. JWT-authenticated Socket.IO gateway,
  rooms per `user:{id}` / `dept:{departmentId}` / `admins`.
  `NotificationsService.create()` and `EngagementEventsService.record()`
  both push through it.
- `src/lib/socket.ts` + `src/hooks/use-engagement-socket.ts` — frontend
  socket client, mounted once from `src/routes/_app.tsx`. Falls back to
  polling everywhere if the socket is down (nothing depends on it being up).
- `src/routes/_app/engagement.tsx` — the Engagement Center page. Metrics
  header (`GET /engagement/metrics`), live Activity Feed, Follow-Up Queue
  (Due Now/Due Today/Overdue) with inline AI-draft-and-send.

**Read `server/src/modules/engagement/engagement-events.service.ts` first.**
Every Phase 4 task below is additive to what's already there — you're
extending `record()`'s callers and `findAll()`'s data, not building new
infrastructure.

---

## Phase 4 scope

### 1. Reply detection (OAuth-connected senders only)

**Why OAuth-only, not everyone:** SMTP-sent mail has no inbox to read from
in this app at all — only an OAuth-connected mailbox (Google/Microsoft) has
anything syncing inbound mail (`server/src/modules/email-oauth/
email-sync-engine.service.ts`). This is a hard constraint of the existing
mail architecture, not a shortcut to fix later.

**What's already there for you:**
- `BulkEmailRecipient.providerMessageId`/`.threadId` and
  `SequenceSend.providerMessageId`/`.threadId` — added in the Phase 1
  migration, currently always `null`. Nothing populates them yet.
- `SyncedEmail.threadId` — already populated by
  `email-sync-engine.service.ts` for every inbound message (Gmail
  `historyId`-based sync sets it from the provider's own thread id; Graph
  sets it from `conversationId`).

**What to build:**
1. In `bulk-email-engine.service.ts` and `sequence-engine.service.ts`,
   capture the provider's message/thread id on send. Today, `emailOAuth.
   sendMail()` (`server/src/modules/email-oauth/email-oauth.service.ts`)
   sends but the return value isn't inspected for an id — check what Gmail's
   `messages.send` / Graph's `/me/sendMail` responses actually return (Gmail
   gives you `id`/`threadId` directly; Graph's `sendMail` returns 202 with no
   body, so for Microsoft you'd need a follow-up `GET /me/messages` lookup by
   `internetMessageId`, or accept that Microsoft-side reply linking needs
   more plumbing than Gmail's). Store whatever you get on the
   `BulkEmailRecipient`/`SequenceSend` row right after a successful OAuth
   send (SMTP/HTTP-fallback sends stay `null` — no thread id available
   there, which is fine, they're just not reply-trackable).
2. In `email-sync-engine.service.ts`'s ingestion path (`upsertSyncedEmail`),
   after a new inbound `SyncedEmail` is created, check whether its
   `threadId` matches any `BulkEmailRecipient.threadId` or
   `SequenceSend.threadId` for that same OAuth connection's owner. On match,
   call `engagementEvents.record({ type: "EMAIL_REPLIED", contactId, ... })`
   — this already scores +30 per Phase 1's `SCORE_TABLE`, no scoring work
   needed.
3. Don't forget: this only fires for the OAuth-connected user whose inbox is
   being synced, which is naturally correct (you're matching against their
   own sent messages).

### 2. Recipient journey view

Per-recipient timeline (Sent → Opened → Opened Again → Clicked → Follow-Up
Sent → Meeting Scheduled), each with a timestamp.

- Backend: `EngagementEventsService.findAll({ recipientId })` already exists
  and already filters/scopes correctly — you may just need to add
  `recipientId` to `EngagementEventFilters` (currently the DTO/query only
  has contactId/dealId/campaignId/sequenceId — `recipientId` isn't wired as
  a filter param yet, check `engagement-events.controller.ts`).
- Frontend: build this as a detail view reachable from the Bulk Email /
  Sequences recipient lists (`src/routes/_app/bulk-email.tsx`,
  `src/routes/_app/outreach.tsx` — check current recipient-list rendering in
  those) — clicking a recipient row opens their journey. Reuse
  `src/routes/_app/engagement.tsx`'s `ActivityFeed`-style rendering
  (icon + label + timestamp per `EngagementEventType`) rather than building
  a new one from scratch; the `EVENT_META` map in that file is the thing to
  extend/reuse.

### 3. Campaign-level analytics enhancements

Total Sent, Delivered, Opened, Open Rate, Clicked, Click Rate, Replied,
Reply Rate, Follow-Ups Generated, Meetings Generated — per campaign/sequence.

- Mirror `EngagementEventsService.getMetrics()`'s shape (it already computes
  sent/opened/clicked/rate math app-wide) but scoped to one
  `campaignId`/`sequenceId` instead of the current user/department. Add e.g.
  `getCampaignMetrics(campaignId)` alongside it, or a query param on the
  existing endpoint — your call, but don't duplicate the rate-math, factor
  it out if you go the param route.
  - "Follow-Ups Generated" = `FollowUpTask.count({ where: { campaignId } })`.
  - "Meetings Generated" needs a `campaignId` or `sequenceId` on
    `EngagementEvent` for `MEETING_BOOKED` rows to filter by — but
    `MEETING_BOOKED` events currently only carry `dealId` (see
    `activities.service.ts`'s emitter), not campaign/sequence. If you want
    this stat to actually mean something, you likely need to join through
    the deal's contact to that contact's `BulkEmailRecipient`/
    `SequenceEnrollment` history — or just scope it out and say so, don't
    fake a number.
- Surface on the existing campaign/sequence detail pages — find wherever
  `BulkEmailCampaign`/`Sequence` detail is currently rendered
  (`src/routes/_app/bulk-email.tsx`, `outreach.tsx`) and add a stats panel,
  same `StatCard`-style component as `engagement.tsx` uses.

### 4. Contact/Deal timeline integration

- `src/components/deal-activity-timeline.tsx` and
  `src/components/contact-detail-sheet.tsx` **already have an established
  convention you must follow, not invent your own**: they render each data
  source (Activities, SyncedEmails, BulkEmailRecipients,
  SequenceEnrollments) as its own separate section, concatenated — never
  merged into one interleaved sorted feed. This was a deliberate choice
  (confirmed in this codebase's own exploration during Phase 1 planning),
  not an oversight. Add an "Engagement" section the same way, sourced from
  `useEngagementEvents({ contactId })` / `useEngagementEvents({ dealId })`
  (`src/hooks/use-engagement.ts` — already supports both filters).
- Don't add a `useEngagementEvents` call with no `contactId`/`dealId`
  filter inside these components — that would pull the global feed. Always
  filter.

---

## Ground rules (carried over from Phases 1-3, still apply)

- **Hand-write Prisma migrations**, don't use `prisma migrate dev` — this
  dev database has pre-existing drift (3 migrations applied directly without
  their SQL ever being committed, from before Phase 1) that makes
  `migrate dev` demand a full reset. Use:
  `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script`
  to generate accurate SQL against the live DB, put it in a new
  `prisma/migrations/<timestamp>_<name>/migration.sql`, then
  `npx prisma migrate deploy` (not `migrate dev`).
- **Windows Prisma client regen**: stop the running backend
  (`Get-NetTCPConnection -LocalPort 4001 -State Listen | Stop-Process`)
  before `npx prisma generate` — the query engine DLL is locked while
  the dev server holds it. See `RUNNING.md`.
- **Every new cross-module effect goes through `EngagementEventsService.
  record()`** — this codebase has no event bus/pub-sub, direct service
  injection is the established pattern everywhere.
- **Verify live, not just `tsc`.** Every phase so far was checked by
  actually triggering the flow through the real API/UI, not just a clean
  typecheck. Do the same for Phase 4 — reply detection especially needs a
  real OAuth test mailbox connected and a real reply sent to confirm the
  thread-id match actually fires.
