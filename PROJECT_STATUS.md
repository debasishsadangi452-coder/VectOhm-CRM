# OmniOS — Project Status

Living snapshot of what's built, how it's wired, and what's next. Update this
file at the end of each phase rather than relying on chat history.

## What this is

OmniOS is an enterprise CRM/ERP/PM platform, built incrementally from a
Scaffolded frontend skeleton (12 placeholder module routes, no
backend) into a working multi-module app with a real NestJS + Postgres
backend.

## Stack

- **Frontend**: TanStack Start (React 19, Vite, file-based routing), Tailwind 4,
  ShadCN, TanStack Query, Zustand, `@dnd-kit` for Kanban boards. Package
  manager: `bun`.
- **Backend**: NestJS (`server/`, a standalone package, not a bun workspace),
  Prisma ORM, PostgreSQL (via Docker Compose, host port 5433).
- **Auth**: JWT access token (in-memory Zustand only, never localStorage) +
  httpOnly rotated/revocable refresh cookie (SHA-256 hashed server-side).
  Global `JwtAuthGuard` + `RolesGuard` via `APP_GUARD`; `@Public()` opts out.

## Running it locally

```
# Postgres (Docker Desktop must be running first)
docker compose up -d

# Backend (from server/)
cd server && bun run start:dev        # http://localhost:4001

# Frontend (from repo root)
bun run dev                            # http://localhost:8080 (Vite auto-picks port)

# Seed / reset all users + CRM data to known-good state
cd server && bun run prisma:seed
```

Login credentials for all 10 seeded accounts: see `CREDENTIALS.md` (gitignored,
**never commit it** — regenerate/consult it locally, don't paste its contents
into chat or docs that get committed).

## RBAC model

Three role tiers (`RoleName`: `ADMIN` / `MANAGER` / `EMPLOYEE`) × 6 departments
(Executive, Dev, Sales, Digital Marketing, Recruitment, HR). A user's display
title (e.g. "Sales Manager", "Dev Head") is derived from tier × department via
`src/lib/role-label.ts`, not a separate field — `Department.managerTitle` lets
a department override "Manager" (Dev uses "Head").

**Permission layers, from loosest to strictest:**

| Resource | Read visibility | Mutation |
|---|---|---|
| Company / Contact | Everyone (shared reference data) | Everyone (no ownership model) |
| Task / Project / Deal | **Department-scoped** (own dept + legacy `departmentId: null` rows; Admin sees all) | Owner/creator, same-department Manager, or Admin |
| Users / Departments (HR directory) | Everyone (company-wide org directory, deliberately NOT department-scoped) | **Admin or HR** (`canManageDirectory`); non-Admins can't touch Admin accounts or grant the Admin role. Department *delete* stays Admin-only (see phase 9). |
| `/admin/settings` | N/A | Admin only (route-guarded) |

**Legacy rows** (`departmentId: null`, i.e. anything created before phase 6)
are treated as unscoped — visible/manageable by any Manager or department, not
just Admin. This is a deliberate backward-compat rule, not a bug.

**Nav filtering** (`src/components/app-sidebar.tsx`): department-specific
module links (CRM, Sales, Recruitment, SEO, Dev) are hidden from users outside
that department; Admin always sees everything. Route-level enforcement uses
`useDepartmentGuard` (`src/hooks/use-department-guard.ts`) — deliberately a
component-level `useEffect`, **not** a router `beforeLoad`, because
`beforeLoad` doesn't reliably re-run client-side for the route already active
during initial hydration (this caused a real stuck-loading-screen regression,
fixed by moving `_app.tsx`'s own auth check to the same pattern). The frontend
guard is UX only — the actual security boundary is the backend's
department-scoped `findAll` queries.

## Module status

| Route | Status |
|---|---|
| `/` (Dashboard) | Partially real — sales KPI cards/revenue chart/top deals wired to real `Deal` aggregates (department-scoped); everything else (sprint board, chat snippet, attendance, team presence, activity feed, SEO snapshot) is still scaffold mock data. |
| `/crm` | Real — Companies, Contacts, Deal pipeline (Kanban), deal activity logging (calls/meetings/notes), approval workflow badge. |
| `/sales` | Real — repurposed from an unbuilt stub into the **Team Performance** view (manager-tier, own department: per-teammate deals/win-rate/quota). |
| `/tasks`, `/projects` | Real — full CRUD, Kanban board (Tasks), department-scoped mutation + visibility. |
| `/hr` | Real — Departments + org hierarchy + employee directory (company-wide, not department-scoped by design). |
| `/dev`, `/seo` | Still `ModulePlaceholder` stubs (no real data model) — now department-guarded so only their own department (+ Admin) can even reach them. |
| `/recruitment` | Real — Job Postings, Candidate pipeline (Kanban), Interview scheduling, Offer management (with an Accept/Decline → Candidate Hired/Rejected cascade), and a real Hiring Analytics dashboard. |
| `/chat`, `/analytics`, `/knowledge` | Still placeholder stubs, no guard added (not department-specific data). |
| `/admin/settings` | Real — Admin-only, route-guarded. |

## Phase history

1. **M1–M7 (backend/auth foundation)**: NestJS + Prisma skeleton, JWT auth +
   global RBAC guards, Users/Roles CRUD, Projects/Tasks CRUD, frontend wired
   to real auth (login/session/logout), Tasks/Projects UI replacing
   placeholders, fixed a silent no-op bug when clearing optional fields
   (`undefined` vs explicit `null` in PATCH bodies).
2. **Phase 2 — HR/Team module**: Departments + org hierarchy + employee
   directory.
3. **Phase 3 — Sales CRM core**: Companies, Contacts, Deals + Pipeline Kanban.
4. **Phase 4 — Deal activity logging**: calls/meetings/notes timeline per deal.
5. **Phase 5 — Real dashboard numbers**: replaced mock sales stats with real
   `Deal` aggregates (open pipeline value, won/lost this month, win rate,
   revenue trend, top open deals).
6. **Phase 6 — Department-scoped roles**: 10 job titles (tier × department),
   `Department.managerTitle`, department-scoped **mutation** privilege for
   Manager tier on Task/Project/Deal (reads still company-wide at this
   point), `/admin/settings` route folder + guard.
7. **Phase 7 — Visibility scoping + Sales Manager features** (current): the
   big gap from phase 6 — reads were still unfiltered, so a Sales Manager
   could *see* Dev/SEO work even though they couldn't edit it. This phase:
   - Made Task/Project/Deal reads + dashboard aggregates department-scoped
     for everyone except Admin (the actual boundary this phase was for).
   - Repurposed `/sales` into a generalized Team Performance view.
   - Added department + per-employee monthly $ targets (quota tracking).
   - Added a deal approval workflow: an Employee closing a deal above
     $10,000 needs Manager/Admin sign-off (`Deal.approvalStatus`:
     `NONE`/`PENDING`/`APPROVED`/`REJECTED`) before it moves to Closed Won.
   - Scoped the Owner/Assignee pickers in Deal/Task dialogs to the current
     user's own department (Admin still sees everyone).
   - Fixed a stuck-loading-screen regression in `_app.tsx` (see RBAC model
     section above for the root cause).

All of phase 7 was verified end-to-end via curl against the running backend
(department-exclusion for Tasks/Projects/Deals/Dashboard, cross-department
approval correctly blocked, same-department approval succeeds, quota fields
persist/clear) — see commit `7ec2120`.

8. **Phase 8 — Recruitment ATS core**: built out `/recruitment` from a
   placeholder into a full applicant tracking system — `JobPosting` →
   `Candidate` (Kanban pipeline: Applied/Screening/Interview/Offer/Hired/
   Rejected) → `Interview` (scheduling + feedback/rating) → `Offer`
   (Accept/Decline cascades the candidate to Hired/Rejected automatically,
   in one transaction) → a real Hiring Analytics summary (open positions,
   pipeline funnel, avg time-to-hire, offer acceptance rate, upcoming
   interviews), all via Prisma `count`/`groupBy` rather than loading
   everything into JS. Same department-scoping convention as Task/Deal/
   Project throughout, with one deliberate exception: `Interview` visibility
   and mutation also allow the assigned interviewer regardless of their
   department, since interviewers are frequently pulled in from outside
   Recruitment (e.g. a Dev engineer running a technical round). Verified
   end-to-end via curl against the running backend (create → schedule
   interview → create offer → accept offer → candidate cascades to HIRED
   with `closedAt` stamped; a Sales Employee gets an empty result set from
   every recruitment endpoint).

9. **Phase 9 — Role-based dashboard + editable hero + GitHub integration**:
   - Rebuilt the main Dashboard (`/`) to be role/department-scoped: each user
     only sees panels for their own department (Sales → revenue/deals, Dev →
     sprint, Recruitment → real pipeline funnel, Digital Marketing → real SEO
     snapshot; Admin sees all). Removed the four hardcoded mock panels
     (Attendance, Team Presence, Upcoming, Recent Activity). Recruitment Pulse
     and SEO Snapshot now show real data instead of fake numbers.
   - Made the Dashboard hero tagline Admin-editable via a new `AppSettings`
     singleton (`/app-settings`, public read + Admin-only write) with a real
     editor in `/admin/settings`. Also fixed `/admin/settings` — it used the
     broken `beforeLoad` guard (URL-reachable by non-Admins); now uses
     `useAdminGuard` like the rest of the app.
   - Self-service GitHub username linking (`PATCH /users/:id/github-username`).
   - **GitHub org integration** (`server/src/modules/github-integration/`):
     Admin connects the company's GitHub org + a classic PAT (`repo` scope) in
     `/admin/settings`. Token is validated against GitHub before storing and
     kept **AES-256-GCM encrypted at rest** (`common/utils/token-crypto.ts`,
     key in `APP_ENCRYPTION_KEY`) — the status endpoint never returns it. Once
     connected, creating a Project auto-creates a **private repo** under the
     org and stores its URL (best-effort — a GitHub failure never blocks
     project creation). The previously-dead `Project.members` relation is now
     live: `POST/DELETE /projects/:id/members` add/remove OmniOS collaborators,
     and a member who has linked their `githubUsername` is auto-invited to the
     repo. All external calls use native `fetch` (no new dependency). Verified:
     encryption round-trip + tamper detection, RBAC (non-Admin 403), real
     GitHub API error handling (bad token → clean 400, surfaced in the UI),
     and full graceful degradation when GitHub is not connected (projects +
     members still work). NOT yet verified against a real org (needs the user's
     own org + token). Inbound commit-tracking webhook is separate and still
     needs the repo-side webhook registered.
   - **Collaborative candidate pipeline**: loosened `CandidatesService`
     `assertCanMutate` from owner-scoped to **same-department** — any recruiter
     can move/edit any candidate in their department, not just the creator (a
     shared pipeline is a team artifact). Job postings/offers stay owner-scoped
     (offers are salary-sensitive). This is the one deliberate departure from
     the app-wide owner-scoped mutation convention.
   - **Global error toasts**: mounted `sonner`'s `<Toaster>` (previously
     installed but never wired) and added a `MutationCache.onError` on the
     QueryClient (`src/router.tsx`) that surfaces every failed mutation with
     the backend's own message. Previously, `.mutate()` calls with no local
     error handling (Kanban drags, sprint completion, brief generation) failed
     silently — the card just snapped back. 401s are skipped (handled by the
     auth-refresh/redirect flow).
   - **HR directory-management power**: the HR department can now create/edit
     employees and manage departments — previously Admin-only, which left the
     dedicated HR role view-only. Gated by `canManageDirectory(user)` =
     Admin OR HR department (`server/src/common/utils/directory-access.ts`);
     the users/departments controllers dropped `@Roles(ADMIN)` on
     create/update/delete and enforce it in the service instead. **Privilege
     escalation is blocked**: a non-Admin (HR) can't create/grant the Admin
     role or edit/deactivate an existing Admin (only a real Admin can touch
     Admins). Department *delete* stays Admin-only (destructive). Frontend HR
     page (`hr.tsx`) unhides its Add/Edit controls for HR via a `canManage`
     flag, and the employee dialog hides the Admin role option from non-Admins.
   - **Team Performance is now Sales-only**: it's a deals/win-rate/quota view,
     meaningless for non-Sales departments, so both the nav (`app-sidebar.tsx`,
     `/sales` added to `DEPARTMENT_ROUTES` as "Sales") and the route guard
     (`sales.tsx` → `useDepartmentGuard("Sales", { managerOnly: true })`) now
     restrict it to Sales Managers + Admin.
   - **Settings link hidden from non-Admins**: `/admin/settings` was always
     route-guarded but its nav link showed to everyone; added
     `ADMIN_ONLY_ROUTES` in `app-sidebar.tsx` so only Admin sees the link.

## Explicitly out of scope (decisions already made, don't relitigate)

- Company/Contact stay open, no department scoping — shared reference data.
- HR employee directory stays company-wide visible — it's an org directory,
  not team-scoped work data.
- No quota history/time-series — single "current monthly target" per
  department/user, no month-over-month tracking yet.
- No notifications/email for pending deal approvals — visible via an
  in-app badge + the Pipeline view only.
- No Department picker in Task/Project/Deal create/edit dialogs — backend
  accepts an optional `departmentId` (defaults to creator's own department)
  but the UI doesn't expose changing it.

## Known rough edges / not yet done

- Dashboard (`/`) is still mostly mock data outside the sales KPIs — sprint
  board, chat snippet, attendance, team presence, activity feed, and SEO
  snapshot are all hardcoded placeholders, not wired to anything.
- `/dev`, `/seo` have no real data model yet — just department-guarded
  placeholder pages listing planned features.
- `/chat`, `/analytics`, `/knowledge` are untouched placeholders.
- Quota tracking is department + per-employee monthly targets only — no
  historical trend, no automatic rollover/reset at month boundary.
- The approval threshold ($10,000) is a hardcoded constant in
  `deals.service.ts`, not admin-configurable.

## Where things live (quick reference)

- Schema: `server/prisma/schema.prisma` · Seed: `server/prisma/seed.ts`
- Department-scoping pattern (read the comments, it's applied identically in
  3 places): `server/src/modules/tasks/tasks.service.ts` (template),
  `projects.service.ts`, `deals.service.ts`
- Approval workflow: `server/src/modules/deals/deals.service.ts`
  (`update`/`approve`/`reject`/`assertCanApprove`)
- Recruitment ATS: `server/src/modules/{job-postings,candidates,interviews,
  offers,recruitment-analytics}` · Offer→Candidate cascade:
  `offers.service.ts` (`update`, uses `$transaction`) · frontend:
  `src/routes/_app/recruitment.tsx`, `src/lib/api/recruitment.ts`,
  `src/hooks/use-recruitment.ts`
- Role label derivation: `src/lib/role-label.ts`
- Route guard pattern: `src/hooks/use-department-guard.ts`
- Nav filtering: `src/components/app-sidebar.tsx`
- Auth store (deliberately no persist middleware): `src/stores/auth-store.ts`
- Auth guard pattern (component `useEffect`, not `beforeLoad`):
  `src/routes/_app.tsx`
