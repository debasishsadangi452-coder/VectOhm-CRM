import { describe, expect, it } from "vitest";
import {
  MODULES,
  SELECTABLE_MODULES,
  canAccessModule,
  defaultAccess,
  defaultModuleKeys,
  hasAreaAccess,
  moduleForPath,
  type AccessUser,
} from "./modules";
// The server enforces the same list; this keeps the two from drifting apart.
import { MODULES as SERVER_MODULES } from "../../server/src/common/utils/modules";

const user = (role: AccessUser["role"]["name"], department: string | null, over: Partial<AccessUser> = {}): AccessUser => ({
  role: { name: role },
  department: department ? { name: department } : null,
  ...over,
});

describe("module catalogue", () => {
  it("matches the server's list (keys, labels, areas, locks)", () => {
    const pick = (m: { key: string; label: string; areas?: string[]; lock?: string; group: string }) => ({
      key: m.key,
      label: m.label,
      group: m.group,
      areas: m.areas ?? [],
      lock: m.lock ?? null,
    });
    expect(MODULES.map(pick)).toEqual(SERVER_MODULES.map(pick));
  });

  it("only offers modules that aren't locked", () => {
    expect(SELECTABLE_MODULES.every((m) => !m.lock)).toBe(true);
  });
});

describe("default access (the rules the sidebar always used)", () => {
  it("shows department modules to that department only", () => {
    expect(defaultAccess(user("EMPLOYEE", "Sales"), "crm")).toBe(true);
    expect(defaultAccess(user("EMPLOYEE", "Dev"), "crm")).toBe(false);
    expect(defaultAccess(user("EMPLOYEE", "Development"), "dev")).toBe(true);
    expect(defaultAccess(user("EMPLOYEE", "Recruitment"), "recruitment")).toBe(true);
    expect(defaultAccess(user("EMPLOYEE", "Digital Marketing"), "seo")).toBe(true);
    expect(defaultAccess(user("EMPLOYEE", "Sales"), "seo")).toBe(false);
  });

  it("opens Intent Hiring and Bulk Email to Sales, Recruitment and people with no department", () => {
    for (const key of ["intent-hiring", "bulk-email"]) {
      expect(defaultAccess(user("EMPLOYEE", "Sales"), key)).toBe(true);
      expect(defaultAccess(user("EMPLOYEE", "Recruitment"), key)).toBe(true);
      expect(defaultAccess(user("EMPLOYEE", null), key)).toBe(true);
      expect(defaultAccess(user("EMPLOYEE", "Dev"), key)).toBe(false);
    }
  });

  it("keeps Manager and HR pages for them, Team Performance for Sales managers, Settings for Admin", () => {
    expect(defaultAccess(user("EMPLOYEE", "HR"), "screen-monitoring")).toBe(true);
    expect(defaultAccess(user("MANAGER", "Dev"), "screen-monitoring")).toBe(true);
    expect(defaultAccess(user("EMPLOYEE", "Sales"), "screen-monitoring")).toBe(false);
    expect(defaultAccess(user("MANAGER", "Sales"), "analytics")).toBe(true);
    expect(defaultAccess(user("EMPLOYEE", "Sales"), "analytics")).toBe(false);
    expect(defaultAccess(user("MANAGER", "Sales"), "sales")).toBe(true);
    expect(defaultAccess(user("MANAGER", "Dev"), "sales")).toBe(false);
    expect(defaultAccess(user("MANAGER", "Sales"), "settings")).toBe(false);
  });

  it("leaves general modules open to everyone", () => {
    for (const key of ["tasks", "hr", "assistant", "chat", "knowledge"]) {
      expect(defaultAccess(user("EMPLOYEE", "Dev"), key)).toBe(true);
    }
  });
});

describe("canAccessModule with a hand-picked list", () => {
  const picked = (modules: string[], role: AccessUser["role"]["name"] = "EMPLOYEE", dept: string | null = "Sales") =>
    user(role, dept, { modulesCustomized: true, modules });

  it("gives exactly the picked modules, whatever the department", () => {
    const u = picked(["tasks", "chat"]);
    expect(canAccessModule(u, "tasks")).toBe(true);
    expect(canAccessModule(u, "chat")).toBe(true);
    expect(canAccessModule(u, "crm")).toBe(false); // a Sales person, but CRM was not picked
    expect(canAccessModule(picked(["crm"], "EMPLOYEE", "Dev"), "crm")).toBe(true); // outside Sales, but picked
  });

  it("always keeps the always-on modules and never grants role-locked ones by ticking", () => {
    const u = picked([]);
    for (const key of ["dashboard", "attendance", "how-to-use"]) expect(canAccessModule(u, key)).toBe(true);
    expect(canAccessModule(picked(["analytics"]), "analytics")).toBe(false);
    expect(canAccessModule(picked(["screen-monitoring"], "MANAGER", "Dev"), "screen-monitoring")).toBe(true); // by role
  });

  it("lets an Admin through everything, and ignores a list on an Admin", () => {
    expect(canAccessModule(picked([], "ADMIN"), "crm")).toBe(true);
    expect(canAccessModule(user("ADMIN", null), "settings")).toBe(true);
  });

  it("leaves people without a list on the default rules", () => {
    expect(canAccessModule(user("EMPLOYEE", "Sales"), "crm")).toBe(true);
    expect(canAccessModule(user("EMPLOYEE", "Dev"), "crm")).toBe(false);
  });
});

describe("hasAreaAccess", () => {
  it("uses the department by default and the picked modules otherwise", () => {
    expect(hasAreaAccess(user("EMPLOYEE", "Sales"), "Sales")).toBe(true);
    expect(hasAreaAccess(user("EMPLOYEE", "Sales"), "Recruitment")).toBe(false);
    const custom = user("EMPLOYEE", "Sales", { modulesCustomized: true, modules: ["tasks", "dev"] });
    expect(hasAreaAccess(custom, "Sales")).toBe(false);
    expect(hasAreaAccess(custom, "Development")).toBe(true);
  });
});

describe("defaultModuleKeys and moduleForPath", () => {
  it("starts a custom list from what the person has by default", () => {
    const keys = defaultModuleKeys({ role: { name: "EMPLOYEE" }, department: { name: "Sales" } });
    expect(keys).toEqual(expect.arrayContaining(["crm", "calls", "tasks", "chat"]));
    expect(keys).not.toContain("recruitment");
    expect(keys).not.toContain("dashboard"); // always-on ones aren't choices
  });

  it("maps URLs to modules, including nested and related pages", () => {
    expect(moduleForPath("/")).toBe("dashboard");
    expect(moduleForPath("/crm")).toBe("crm");
    expect(moduleForPath("/deals/123")).toBe("crm");
    expect(moduleForPath("/projects/abc")).toBe("projects");
    expect(moduleForPath("/admin/settings")).toBe("settings");
    expect(moduleForPath("/account")).toBeUndefined();
    expect(moduleForPath("/users/new")).toBeUndefined();
  });
});
