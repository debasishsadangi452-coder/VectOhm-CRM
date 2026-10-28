import { isDepartmentMatch } from "@/lib/department-match";

// The modules (sidebar pages) an Admin can switch on or off for a person. The keys, labels, areas and locks
// mirror server/src/common/utils/modules.ts (which enforces the same list on the APIs); this file adds the page
// paths and the default access rules.
//
//   lock "always" - everyone has it (Dashboard, Attendance, How to Use), so it is never offered as a choice.
//   lock "role"   - follows role/department only (Manager or HR pages, Admin Settings): the data behind it is
//                   protected by role on the server, so ticking a box could not open it.

export type ModuleGroup = "CORE" | "SPRINTS" | "WORKSPACE";

export interface ModuleDef {
  key: string;
  label: string;
  to: string;
  group: ModuleGroup;
  /** Department APIs this module's pages call. */
  areas?: string[];
  lock?: "always" | "role";
}

export const MODULES: ModuleDef[] = [
  { key: "dashboard", label: "Dashboard", to: "/", group: "CORE", lock: "always" },
  { key: "crm", label: "CRM & Sales", to: "/crm", group: "CORE", areas: ["Sales"] },
  { key: "projects", label: "Projects", to: "/projects", group: "CORE", areas: ["Development"] },
  { key: "tasks", label: "Tasks", to: "/tasks", group: "CORE" },
  { key: "hr", label: "HRMS Portal", to: "/hr", group: "CORE" },
  { key: "assistant", label: "Assistant", to: "/assistant", group: "CORE" },

  { key: "sales", label: "Team Performance", to: "/sales", group: "SPRINTS", areas: ["Sales"], lock: "role" },
  { key: "engagement", label: "Engagement Center", to: "/engagement", group: "SPRINTS", areas: ["Sales"] },
  { key: "outreach", label: "Outreach", to: "/outreach", group: "SPRINTS", areas: ["Sales"] },
  { key: "inbox", label: "Inbox", to: "/inbox", group: "SPRINTS", areas: ["Sales"] },
  { key: "sent", label: "Sent", to: "/sent", group: "SPRINTS", areas: ["Sales"] },
  { key: "calls", label: "Calls", to: "/calls", group: "SPRINTS", areas: ["Sales"] },
  { key: "recruitment", label: "Recruitment", to: "/recruitment", group: "SPRINTS", areas: ["Recruitment"] },
  { key: "priority-center", label: "Recruiter Priority Center", to: "/priority-center", group: "SPRINTS", areas: ["Recruitment"] },
  { key: "recruitment-stream", label: "Daily Recruitment Stream", to: "/recruitment-stream", group: "SPRINTS", areas: ["Recruitment"] },
  { key: "intent-hiring", label: "Intent Hiring", to: "/intent-hiring", group: "SPRINTS", areas: ["Sales", "Recruitment"] },
  { key: "bulk-email", label: "Email Campaigns", to: "/bulk-email", group: "SPRINTS", areas: ["Sales", "Recruitment"] },
  { key: "seo", label: "SEO Monitor", to: "/seo", group: "SPRINTS", areas: ["Digital Marketing"] },
  { key: "dev", label: "Dev Sprints", to: "/dev", group: "SPRINTS", areas: ["Development"] },
  { key: "attendance", label: "Attendance", to: "/attendance", group: "SPRINTS", lock: "always" },

  { key: "chat", label: "Team Chat", to: "/chat", group: "WORKSPACE" },
  { key: "analytics", label: "Analytics", to: "/analytics", group: "WORKSPACE", lock: "role" },
  { key: "knowledge", label: "Knowledge Base", to: "/knowledge", group: "WORKSPACE" },
  { key: "screen-monitoring", label: "Screen Monitoring", to: "/screen-monitoring", group: "WORKSPACE", lock: "role" },
  { key: "employee-daily-log", label: "Employee Daily Log", to: "/employee-daily-log", group: "WORKSPACE", lock: "role" },
  { key: "login-photos", label: "Login Photos", to: "/login-photos", group: "WORKSPACE", lock: "role" },
  { key: "how-to-use", label: "How to Use CRM", to: "/how-to-use", group: "WORKSPACE", lock: "always" },
  { key: "settings", label: "Settings", to: "/admin/settings", group: "WORKSPACE", lock: "role" },
];

export const GROUP_LABELS: Record<ModuleGroup, string> = {
  CORE: "Core",
  SPRINTS: "Sprints",
  WORKSPACE: "Workspace",
};

const BY_KEY = new Map(MODULES.map((m) => [m.key, m]));

/** Modules an Admin can switch on or off for someone. */
export const SELECTABLE_MODULES = MODULES.filter((m) => !m.lock);

/** The part of the person the rules look at. */
export interface AccessUser {
  role: { name: "ADMIN" | "MANAGER" | "EMPLOYEE" | string };
  department?: { name: string } | null;
  modulesCustomized?: boolean;
  modules?: string[];
}

// Which department's people see a module by default.
const DEFAULT_DEPARTMENT: Record<string, string> = {
  projects: "Development",
  dev: "Development",
  crm: "Sales",
  sales: "Sales",
  engagement: "Sales",
  outreach: "Sales",
  inbox: "Sales",
  sent: "Sales",
  calls: "Sales",
  recruitment: "Recruitment",
  "priority-center": "Recruitment",
  "recruitment-stream": "Recruitment",
  seo: "Digital Marketing",
};

/**
 * What a person gets for a module when no one has picked their modules by hand: the rules the sidebar has
 * always used (by role and department).
 */
export function defaultAccess(user: AccessUser, key: string): boolean {
  if (user.role.name === "ADMIN") return true;
  const dept = user.department?.name;
  const isHR = isDepartmentMatch(dept, "HR");
  const isManager = user.role.name === "MANAGER";
  switch (key) {
    case "settings":
      return false;
    case "intent-hiring":
    case "bulk-email":
      return isDepartmentMatch(dept, "Sales") || isDepartmentMatch(dept, "Recruitment") || !dept;
    case "screen-monitoring":
    case "employee-daily-log":
    case "login-photos":
      return isHR || isManager;
    case "analytics":
      return isManager;
    case "sales":
      return isManager && isDepartmentMatch(dept, "Sales");
  }
  const required = DEFAULT_DEPARTMENT[key];
  if (required && !isDepartmentMatch(dept, required)) return false;
  return true;
}

/** Whether a person can use a module: Admin always; otherwise their hand-picked list, or the default. */
export function canAccessModule(user: AccessUser | null | undefined, key: string): boolean {
  if (!user) return false;
  if (user.role.name === "ADMIN") return true;
  const def = BY_KEY.get(key);
  if (!def) return true; // not a managed module
  if (def.lock === "always") return true;
  if (def.lock === "role") return defaultAccess(user, key);
  if (user.modulesCustomized) return (user.modules ?? []).includes(key);
  return defaultAccess(user, key);
}

/**
 * Whether a person can use a department's APIs (Sales, Recruitment, Development, Digital Marketing): by
 * department, or, for someone with a hand-picked list, through any module in that area. Mirrors the server.
 */
export function hasAreaAccess(user: AccessUser | null | undefined, department: string): boolean {
  if (!user) return false;
  if (user.role.name === "ADMIN") return true;
  if (user.modulesCustomized) {
    const granted = new Set(user.modules ?? []);
    return MODULES.some((m) => granted.has(m.key) && (m.areas ?? []).some((a) => isDepartmentMatch(a, department)));
  }
  return isDepartmentMatch(user.department?.name, department);
}

/** The modules someone gets by default, as keys of the selectable ones. Used to start a custom list. */
export function defaultModuleKeys(user: Pick<AccessUser, "role" | "department">): string[] {
  return SELECTABLE_MODULES.filter((m) => defaultAccess({ ...user, modulesCustomized: false }, m.key)).map((m) => m.key);
}

// First path segment -> module, for pages that should be closed to someone without that module.
const SEGMENT_TO_MODULE: Record<string, string> = {
  "": "dashboard",
  crm: "crm",
  deals: "crm",
  companies: "crm",
  contacts: "crm",
  projects: "projects",
  tasks: "tasks",
  hr: "hr",
  assistant: "assistant",
  sales: "sales",
  engagement: "engagement",
  outreach: "outreach",
  inbox: "inbox",
  sent: "sent",
  calls: "calls",
  recruitment: "recruitment",
  "priority-center": "priority-center",
  "recruitment-stream": "recruitment-stream",
  "intent-hiring": "intent-hiring",
  "bulk-email": "bulk-email",
  seo: "seo",
  dev: "dev",
  attendance: "attendance",
  chat: "chat",
  analytics: "analytics",
  knowledge: "knowledge",
  "screen-monitoring": "screen-monitoring",
  "employee-daily-log": "employee-daily-log",
  "login-photos": "login-photos",
  "how-to-use": "how-to-use",
  admin: "settings",
};

/** The managed module a URL belongs to, or undefined for pages outside the module list (account, new user...). */
export function moduleForPath(pathname: string): string | undefined {
  const segment = pathname.split("/").filter(Boolean)[0] ?? "";
  return SEGMENT_TO_MODULE[segment];
}
