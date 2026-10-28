// The modules (sidebar pages) an Admin can switch on or off for a person. Keep this list in step with
// src/lib/modules.ts in the web app, which adds the page paths and the default access rules.
//
// `areas` are the department APIs a module's pages call (see @Department(...) on the controllers). A person
// with hand-picked modules passes a department-restricted API only if one of their modules covers it.
//
// `lock`:
//   "always" - everyone has it, so it is not offered as a choice (Dashboard, Attendance, How to Use).
//   "role"   - governed by role/department only (Manager or HR pages, Admin Settings). Granting it from a
//              checklist would not open the data behind it, so it is not offered either.

export type ModuleGroup = "CORE" | "SPRINTS" | "WORKSPACE";

export interface ModuleDef {
  key: string;
  label: string;
  group: ModuleGroup;
  areas?: string[];
  lock?: "always" | "role";
}

export const MODULES: ModuleDef[] = [
  { key: "dashboard", label: "Dashboard", group: "CORE", lock: "always" },
  { key: "crm", label: "CRM & Sales", group: "CORE", areas: ["Sales"] },
  { key: "projects", label: "Projects", group: "CORE", areas: ["Development"] },
  { key: "tasks", label: "Tasks", group: "CORE" },
  { key: "hr", label: "HRMS Portal", group: "CORE" },
  { key: "assistant", label: "Assistant", group: "CORE" },

  { key: "sales", label: "Team Performance", group: "SPRINTS", areas: ["Sales"], lock: "role" },
  { key: "engagement", label: "Engagement Center", group: "SPRINTS", areas: ["Sales"] },
  { key: "outreach", label: "Outreach", group: "SPRINTS", areas: ["Sales"] },
  { key: "inbox", label: "Inbox", group: "SPRINTS", areas: ["Sales"] },
  { key: "sent", label: "Sent", group: "SPRINTS", areas: ["Sales"] },
  { key: "calls", label: "Calls", group: "SPRINTS", areas: ["Sales"] },
  { key: "recruitment", label: "Recruitment", group: "SPRINTS", areas: ["Recruitment"] },
  { key: "priority-center", label: "Recruiter Priority Center", group: "SPRINTS", areas: ["Recruitment"] },
  { key: "recruitment-stream", label: "Daily Recruitment Stream", group: "SPRINTS", areas: ["Recruitment"] },
  { key: "intent-hiring", label: "Intent Hiring", group: "SPRINTS", areas: ["Sales", "Recruitment"] },
  { key: "bulk-email", label: "Email Campaigns", group: "SPRINTS", areas: ["Sales", "Recruitment"] },
  { key: "seo", label: "SEO Monitor", group: "SPRINTS", areas: ["Digital Marketing"] },
  { key: "dev", label: "Dev Sprints", group: "SPRINTS", areas: ["Development"] },
  { key: "attendance", label: "Attendance", group: "SPRINTS", lock: "always" },

  { key: "chat", label: "Team Chat", group: "WORKSPACE" },
  { key: "analytics", label: "Analytics", group: "WORKSPACE", lock: "role" },
  { key: "knowledge", label: "Knowledge Base", group: "WORKSPACE" },
  { key: "screen-monitoring", label: "Screen Monitoring", group: "WORKSPACE", lock: "role" },
  { key: "employee-daily-log", label: "Employee Daily Log", group: "WORKSPACE", lock: "role" },
  { key: "login-photos", label: "Login Photos", group: "WORKSPACE", lock: "role" },
  { key: "how-to-use", label: "How to Use CRM", group: "WORKSPACE", lock: "always" },
  { key: "settings", label: "Settings", group: "WORKSPACE", lock: "role" },
];

/** Modules an Admin can switch on or off. */
export const SELECTABLE_MODULES = MODULES.filter((m) => !m.lock);
export const SELECTABLE_MODULE_KEYS = SELECTABLE_MODULES.map((m) => m.key);

/** Splits a list of keys into the valid ones (deduplicated, in catalogue order) and the unknown ones. */
export function sanitizeModules(keys: string[]): { valid: string[]; invalid: string[] } {
  const wanted = new Set(keys);
  const invalid = [...wanted].filter((k) => !SELECTABLE_MODULE_KEYS.includes(k));
  const valid = SELECTABLE_MODULE_KEYS.filter((k) => wanted.has(k));
  return { valid, invalid };
}
