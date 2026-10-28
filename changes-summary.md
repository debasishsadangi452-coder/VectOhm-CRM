# Summary of Changes — Pairing Session

This document details all modifications, fixes, and new features implemented across the database, NestJS server, React frontend, and Electron desktop app during this pairing session.

---

## 1. Desktop App Icon & Taskbar Grouping Fixes
* **Installer Executable Properties Enabled:** Removed `"signAndEditExecutable": false` from the Windows target in the desktop agent's [package.json](file:///c:/Users/satap/Desktop/gentle-crm-glide-main/desktop-agent/package.json#L29-L32). This allows `electron-builder` to write the brand icon and app metadata into the final `.exe`.
* **Taskbar App Pinning:** Added `app.setAppUserModelId("com.venuscrm.desktopagent")` inside `app.whenReady()` in the desktop agent's [main.ts](file:///c:/Users/satap/Desktop/gentle-crm-glide-main/desktop-agent/src/main.ts#L101-L105). This binds Windows processes to the taskbar shortcut, fixing blank icon groupings.
* **Shortcut Repair Diagnostics:** Created diagnostic PowerShell scripts to verify executable icon injection and repair corrupted `IconLocation` paths in Windows `.lnk` shortcuts.

---

## 2. Global Search Command Palette (⌘K / Ctrl+K)
* **Command Dialog Integration:** Created a new [command-palette.tsx](file:///c:/Users/satap/Desktop/gentle-crm-glide-main/src/components/command-palette.tsx) component hosting a `cmdk` palette. 
* **Role-Scoped Results:** Results are dynamically fetched and filtered based on the logged-in user's department:
  * **Sales:** Deals, Contacts, Companies.
  * **Dev:** Projects, Tasks.
  * **Recruitment:** Candidates, Job Postings.
  * **HR:** Employees directory.
* **Interface Triggers:** Tied `onClick` handlers to the search input in the main Topbar and the "Command palette" button in the Sidebar, along with a document-level `keydown` listener for `Cmd+K` / `Ctrl+K`.

---

## 3. Scoped "New Entry" Dropdown Actions
* **Universal Form Dialog Mounts:** Created [global-dialogs.tsx](file:///c:/Users/satap/Desktop/gentle-crm-glide-main/src/components/global-dialogs.tsx) to mount all entity creation forms (deals, tasks, projects, candidates, employees, leave requests) globally in the root layout shell.
* **Department-Tailored Actions:** Wrapped the static "New Entry" button in the Topbar in a dropdown menu showing scoped actions matching the user's category:
  * **Sales:** Create Deal, Contact, Company.
  * **Dev:** Create Project, Task.
  * **Recruitment:** Create Candidate, Job Posting.
  * **HR:** Create Employee, Department.
  * **All other users:** Create Task, Request Leave.

---

## 4. Sleep Logout & Session Persistence Fixes
* **30-Day Refresh Token TTL:** Increased the default refresh token TTL from `7d` to `30d` inside the server's [auth.service.ts](file:///c:/Users/satap/Desktop/gentle-crm-glide-main/server/src/modules/auth/auth.service.ts).
* **Dynamic Cookie Lifespans:** Modified the server session cookie to dynamically match this new 30-day token lifetime, ensuring the browser doesn't discard sessions prematurely during laptop sleep or long periods of inactivity.

---

## 5. Email Open (Read) Tracking Pixel
* **Database Schema Columns:** Added `openedAt` (`DateTime?`) and `openCount` (`Int`) columns to `BulkEmailRecipient` and `SequenceSend` tables in [schema.prisma](file:///c:/Users/satap/Desktop/gentle-crm-glide-main/server/prisma/schema.prisma).
* **Tracking Endpoints:** Created a public [tracking.controller.ts](file:///c:/Users/satap/Desktop/gentle-crm-glide-main/server/src/modules/tracking/tracking.controller.ts) which returns a 1x1 transparent GIF buffer, increments read counts in the DB, and pushes a real-time browser notification to the salesperson when their email is first opened.
* **Hidden Pixel Injections:** Integrated tracking pixel URLs into HTML templates within both the bulk email engine and the sequence drip engine.

---

## 6. Follow-Up Dashboard Widget & CRM History
* **Dashboard Reminders Card:** Implemented a new "Follow-Up Reminders" widget card on the main [Dashboard page](file:///c:/Users/satap/Desktop/gentle-crm-glide-main/src/routes/_app/index.tsx) displaying contacts who have not opened emails sent 3+ days ago.
* **CRM Email History Timeline:** Updated the contact slide-out details panel ([contact-detail-sheet.tsx](file:///c:/Users/satap/Desktop/gentle-crm-glide-main/src/components/contact-detail-sheet.tsx)) to display a comprehensive list of all sent bulk emails and sequence steps along with their live read counts and timestamps.
