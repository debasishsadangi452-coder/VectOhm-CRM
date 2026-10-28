# OmniOS — Who Can Do What

A complete map of access control across every module, as of the current build.
Verified against the code (file references are clickable in the IDE).

---

## 1. How permissions are decided

Access is the combination of **three independent things** — not just a single
"role":

| Mechanism | Question it answers | Example |
|---|---|---|
| **Role tier** — `ADMIN` / `MANAGER` / `EMPLOYEE` | How much authority within scope | Only a Manager sees Team Performance |
| **Department** — Dev / Sales / Digital Marketing / Recruitment / HR / Executive | Which team's world you live in | A Sales person sees CRM; a Dev person sees Dev Sprints |
| **Ownership** — did you create/are you assigned to the record | Can you edit *this* row | You can edit your own deal, not a teammate's |

Two departments carry **special company-wide powers** regardless of anything else:
- **HR department** → manage the people directory (`canManageDirectory` = Admin **or** HR) — [directory-access.ts](server/src/common/utils/directory-access.ts)
- **Sales department** → use Sales Outreach (`canUseSalesOutreach` = Admin **or** Sales) — [sales-access.ts](server/src/common/utils/sales-access.ts)

**Admin is a global override** — an Admin can see and do everything, everywhere.

Cross-cutting data rules (apply to CRM, Projects, Tasks, SEO, Recruitment, Dev, etc.):
- **See:** `visibilityScope` — Admin sees all; everyone else sees **their own department's** records (+ company-wide/unscoped rows).
- **Edit/Delete:** `assertCanMutate` — the **owner**, an **Admin**, or a **same-department Manager**.

---

## 2. The people (current roster)

| Person | Role | Department | Special power |
|---|---|---|---|
| **Paresh Kumar** | Admin | Executive | Everything |
| **Megan Foster** | Admin | Recruitment | Everything |
| **Jivan Satapathy** | Manager | Dev | Dev department |
| **Jon Carter** | Manager | Sales | Sales + Outreach |
| **Shantanu Tyagi** | Manager | Digital Marketing | Digital Marketing / SEO Hub (`digital@venushiring.ca`) |
| **Hana Resources** | Manager | HR | People directory + all HR tools |
| Debasish, Subhram, Pratyush | Employee | Dev | — |
| Dip, Sourav, Divya, Ankit, Priya | Employee | Sales | Sales + Outreach |
| Aditya, Sneha, Rohit, +7 | Employee | Recruitment | Recruitment |

---

## 3. What each department sees in the sidebar

Everyone signed in sees: **Dashboard, Projects, Tasks, HRMS Portal, Attendance,
Team Chat, Analytics, Knowledge Base**. Department-specific links are added on
top ([app-sidebar.tsx](src/components/app-sidebar.tsx)):

| Department | Extra nav links |
|---|---|
| **Sales** | CRM & Sales, Outreach, Team Performance *(Managers only)* |
| **Dev** | Dev Sprints |
| **Digital Marketing** | SEO Monitor |
| **Recruitment** | Recruitment |
| **HR** | (base only — but full directory power *inside* the HRMS Portal) |
| **Executive / Admin** | **All of the above + Settings** |

A Sales manager can't even *see* the Dev Sprints or SEO links, and the backend
independently scopes the data — the nav just hides what isn't yours.

**How to Use CRM** is the one link gated purely on **role tier, not department**:
every Manager (Jon, Jivan, Shantanu, Megan, Hana) plus Admin sees it; no Employee
does. See [§4 How to Use CRM](#how-to-use-crm--training-videos).

---

## 4. Module-by-module

### Employee directory & departments — `canManageDirectory` (Admin or HR)
| Action | Who |
|---|---|
| View employees / departments | Everyone (read-only) |
| Add / edit / deactivate an employee; reset their password | **Admin, HR** |
| Add / edit a department | **Admin, HR** |
| Delete a department | **Admin only** |
| Create/edit an **Admin** account, or promote to Admin | **Admin only** |
| Change anyone's **email** | **Nobody** (email is the locked login id) |

### CRM & Sales (deals, contacts, companies, activities)
| Action | Who |
|---|---|
| View | **Sales** dept (their data) + Admin |
| Create / edit / delete a record | Owner, same-dept **Sales Manager**, or Admin |
| Team Performance (`/sales` leaderboard, quotas) | **Sales Managers + Admin** |

### Sales Outreach (Apollo, Templates, Sequences) — `canUseSalesOutreach` (Admin or Sales)
| Action | Who |
|---|---|
| Find/import leads, build templates, run sequences | **Sales** dept + Admin — [sales-access.ts](server/src/common/utils/sales-access.ts) |
| **Connect / disconnect Apollo** account | **Admin only** — [apollo-connection.controller.ts](server/src/modules/apollo-integration/apollo-connection.controller.ts) |
| Manually trigger the sequence engine (`/sequences/engine/run`) | **Admin only** |

### Projects & Tasks
| Action | Who |
|---|---|
| View | Own department + Admin |
| Create / edit / delete | Owner, same-dept Manager, or Admin |
| Post a **daily task update** | The task's **assignee/creator**, same-dept Manager, or Admin — [task-updates.service.ts](server/src/modules/task-updates/task-updates.service.ts) |
| Add repo / GitHub collaborators to a project | Project owner / same-dept Manager / Admin |

### Dev Sprints · SEO · Recruitment
Same shape: **view** = that department + Admin; **create/edit/delete** =
owner / same-dept Manager / Admin. (Dev = Dev dept, SEO = Digital Marketing,
Recruitment = Recruitment dept.)

### Leave management — [leave-requests.service.ts](server/src/modules/leave-requests/leave-requests.service.ts)
| Action | Who |
|---|---|
| Request leave | **Anyone** (for themselves) |
| Cancel a **pending** request | The **owner** only |
| View **all** requests + the stats overview | **Admin, HR** |
| Approve / reject a request | **Admin, HR** |
| View own requests | Everyone (their own) |

### Attendance / Work Sessions — [work-sessions.service.ts](server/src/modules/work-sessions/work-sessions.service.ts)
| Action | Who |
|---|---|
| Clock in / out (start a session) | **Anyone** (for themselves) |
| View **everyone's** sessions (payroll view) | **Admin, HR** |
| View own sessions | Everyone (their own) |

### Login Activity (audit trail) — [login-events.controller.ts](server/src/modules/login-events/login-events.controller.ts)
| Action | Who |
|---|---|
| See who signed in/out, when, device, IP | **Admin, HR** |
| "Last login" column in the directory | **Admin, HR** |

### Notifications
Every user sees and manages **only their own** in-app notifications.

### Chat · Knowledge Base · Analytics · Dashboard
- **Chat / Knowledge Base:** all users; content is department-scoped.
- **Analytics / Dashboard:** department-scoped panels; Admin sees org-wide.

### How to Use CRM — training videos
Recorded walkthroughs of the CRM itself, listed on
[/how-to-use](src/routes/_app/how-to-use.tsx). Not department-scoped — the
material is about the tool, so every department's Manager sees the same
library, including each other's entries
([training-videos.service.ts](server/src/modules/training-videos/training-videos.service.ts)).

| Action | Who |
|---|---|
| Watch the videos | **Admin, any Manager** — Employees get 403 and don't see the nav link |
| Add a video link | **Admin, any Manager** — so a Sales Manager can post walkthroughs for their own team |
| Edit its details / remove it | **Whoever added it, or Admin** — a Manager owns what they posted and nothing else |

**This app stores links, not video files.** A row is a URL (Google Drive,
YouTube, Loom, Vimeo) plus its title and section; the bytes live wherever the
poster put them. Recognized providers are turned into an inline player
([video-embed.ts](src/lib/video-embed.ts)), anything else opens in a new tab.

That means access to the video itself is governed by *that provider's*
sharing settings, not by this table — a Drive file has to be set to "Anyone
with the link" or viewers hit a Google permission wall. Removing a row here
never deletes the underlying recording.

### Admin-only settings
| Action | Who |
|---|---|
| App settings / dashboard hero text | **Admin only** — [app-settings.controller.ts](server/src/modules/app-settings/app-settings.controller.ts) |
| GitHub org connection | **Admin only** |
| Apollo connection | **Admin only** |

### Self-service (every user, for themselves)
- Edit own name / avatar
- Request a password reset (emailed link) — email is never editable
- Link own GitHub username

---

## 5. Quick matrix

| Capability | Employee | Manager | HR | Sales | Admin |
|---|:--:|:--:|:--:|:--:|:--:|
| See own dept's data | ✅ | ✅ | ✅ | ✅ | ✅ (all) |
| Edit own records | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit teammates' records (same dept) | ❌ | ✅ | ❌ | mgr only | ✅ |
| Manage employees & departments | ❌ | ❌ | ✅ | ❌ | ✅ |
| Approve leave / see all leave | ❌ | ❌ | ✅ | ❌ | ✅ |
| See all attendance | ❌ | ❌ | ✅ | ❌ | ✅ |
| See login audit trail | ❌ | ❌ | ✅ | ❌ | ✅ |
| Team Performance | ❌ | ✅ (Sales) | ❌ | mgr only | ✅ |
| Use Sales Outreach | ❌ | Sales only | ❌ | ✅ | ✅ |
| Request leave / clock in-out | ✅ | ✅ | ✅ | ✅ | ✅ |
| App / GitHub / Apollo settings | ❌ | ❌ | ❌ | ❌ | ✅ |
| Touch Admin accounts | ❌ | ❌ | ❌ | ❌ | ✅ |

> "Manager" = a department Manager acting **within their own department**.
> "HR" and "Sales" columns = the department-based powers, which stack on top of
> that person's role tier.

---

## 6. Notes worth remembering

- **HR power is by department, not role** — any user placed in the HR department
  gets full directory/leave/attendance/audit access, even an Employee. Same for
  **Sales** and Outreach. Tighten to "Manager of that department" if you want
  employees there to be read-only.
- **Email can never be changed** by anyone (it's the login identifier).
- **Admin is the only tier that crosses departments** — a Sales Manager has no
  visibility into Dev or Recruitment data.

*Generated from a walk-through of the codebase; see also [HR.md](HR.md) for the
HR-specific deep dive.*
