# HR Capabilities — OmniOS

This document describes everything the **HR** team can do in OmniOS today, the
hard limits that constrain them, and recommended features HR could grow into.

> **Who is "HR"?** Authority is granted by **department membership**, not role.
> Anyone whose department is `"HR"` — *or* any Admin — passes the
> `canManageDirectory()` check and gets the powers below.
> Source: [directory-access.ts](server/src/common/utils/directory-access.ts)

---

## 1. What HR can do today

### 1.1 Employee directory (company-wide)
HR manages **every** employee in the company, not just the HR department.

| Action | Details | Where |
|---|---|---|
| **View all employees** | Full directory with filters (department, role, status) | HRMS Portal → Employees |
| **Add an employee** | Name, email, initial password, role, department, reporting manager, avatar, GitHub username, monthly target | "Add Employee" |
| **Edit an employee** | Change name, role, department, reassign manager, set monthly target, **reset their password**, activate/deactivate | Click any row |
| **Deactivate (soft delete)** | Disables login but preserves the person's task/project history | Edit form |

Backend: [users.service.ts](server/src/modules/users/users.service.ts) · [users.controller.ts](server/src/modules/users/users.controller.ts)
UI: [hr.tsx](src/routes/_app/hr.tsx) · [employee-form-dialog.tsx](src/components/employee-form-dialog.tsx)

### 1.2 Department management
| Action | Details | Where |
|---|---|---|
| **View all departments** | Name, description, head, headcount | HRMS Portal → Departments |
| **Add a department** | Name, description, assigned head | "Add Department" |
| **Edit a department** | Rename, description, reassign head, set monthly target & deal-approval threshold | Click any row |

Backend: [departments.service.ts](server/src/modules/departments/departments.service.ts) · [departments.controller.ts](server/src/modules/departments/departments.controller.ts)

### 1.3 Login activity / audit trail
| Action | Details | Where |
|---|---|---|
| **See sign-in / sign-out history** | Who signed in/out, when, device, IP address — newest first | HRMS Portal → Login Activity |
| **Filter by employee** | Drill into one person's session history | Dropdown on that tab |
| **See "Last login"** per employee | Most recent sign-in at a glance | Employees tab column |

Reloads use the refresh cookie (not a fresh login), so they don't pollute the
log — only real sign-ins are recorded. Events auto-purge after **90 days**.
Backend: [login-events](server/src/modules/login-events) · recording in [auth.service.ts](server/src/modules/auth/auth.service.ts)

### 1.4 Self-service (same as every user)
- Edit their **own** profile (name, avatar).
- Request a **password reset** via emailed link.
- Link their **own** GitHub username.

### 1.5 Standard workspace (scoped to the HR department)
Dashboard, Projects, Tasks, Team Chat, Analytics, and Knowledge Base — all
scoped to HR's own department, like any other manager.

---

## 2. What HR **cannot** do (hard limits in code)

| Blocked action | Why |
|---|---|
| Create, edit, deactivate, or promote to **Admin** | Only a real Admin can touch Admin accounts ([users.service.ts:105](server/src/modules/users/users.service.ts#L105), [:222](server/src/modules/users/users.service.ts#L222)) |
| Change **anyone's email** | Email is the locked login identifier — no endpoint writes it |
| **Delete** a department | Admin-only ([departments.controller.ts:47](server/src/modules/departments/departments.controller.ts#L47)) |
| Link **someone else's** GitHub | Self-service only (you or an Admin) |
| See **other departments'** business data (deals, pipelines, etc.) | HR's elevated power is the *people directory*, not other teams' work |

---

## 3. Design note worth knowing

HR power is keyed on **department = "HR"**, regardless of role. Today only the
HR *Manager* (Hana) is in HR, so it's just her. But if an HR **employee** were
added, they'd get the **same full directory power**. If you want HR employees to
be read-only and reserve editing for the HR *manager*, that's a one-line change
(`Admin OR HR-department Manager`).

---

## 4. Recommended — what HR could do more

Ranked roughly by value-vs-effort, and noting what each builds on.

### High value, natural fit
1. **Richer employee profiles** — phone, address, emergency contact, date of
   birth, join date, employment type (full-time/contract). *Builds on:* the
   existing employee form; just more fields + schema columns.
2. **Onboarding / offboarding checklists** — a task list triggered when someone
   is hired or deactivated (equipment, accounts, docs signed). *Builds on:* the
   Recruitment "Hired" cascade and the Tasks module already in the app.
3. **Leave / PTO management** — employees request time off; HR/managers approve;
   balances tracked. *New module,* but mirrors the existing request→approve
   patterns (e.g. deal approvals).
4. **Session management** — see who's currently signed in and **force-logout**
   (revoke sessions) for a departing or compromised account. *Builds on:* the
   existing refresh-token table + the new login-events trail.

### Medium value
5. **Org chart** — visualize reporting lines. *Builds on:* the `manager`
   relation already stored on every user — no new data needed.
6. **Headcount & attrition analytics** — hires vs. departures over time,
   headcount by department. *Builds on:* `isActive`, deactivation dates, and the
   Recruitment "Hired" offers.
7. **Employee documents** — store contracts/policies and track policy
   acknowledgements. *New,* needs file storage.
8. **Bulk employee import (CSV)** — onboard many people at once. *Builds on:*
   the existing create endpoint.
9. **Company announcements** — HR broadcasts to all staff. *Builds on:* the Chat
   module / a pinned "general" channel.

### Sensitive / later
10. **Compensation management** — salaries, raises. High sensitivity; needs
    stricter access control than the current HR gate.
11. **Performance reviews** — review cycles, goals, ratings.
12. **Login anomaly alerts** — flag unusual sign-in times/locations from the
    audit trail (e.g. surface it to HR proactively).

---

*Generated from a walk-through of the codebase. File references are clickable
in the IDE.*
