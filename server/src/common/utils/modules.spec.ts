import { ForbiddenException, BadRequestException } from "@nestjs/common";
import { hasDepartmentAccess, moduleGrantsArea } from "./department-access";
import { MODULES, SELECTABLE_MODULE_KEYS, sanitizeModules } from "./modules";
import { UsersService } from "../../modules/users/users.service";
import type { RequestUser } from "../types/request-user.type";

describe("module catalogue", () => {
  it("has unique keys and never offers always-on or role-locked modules as a choice", () => {
    const keys = MODULES.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const locked of ["dashboard", "attendance", "how-to-use", "settings", "analytics", "screen-monitoring", "sales"]) {
      expect(SELECTABLE_MODULE_KEYS).not.toContain(locked);
    }
    expect(SELECTABLE_MODULE_KEYS).toEqual(expect.arrayContaining(["crm", "tasks", "chat", "recruitment", "dev", "seo"]));
  });

  it("sanitizes: drops duplicates, keeps catalogue order and reports unknown keys", () => {
    expect(sanitizeModules(["tasks", "crm", "tasks"])).toEqual({ valid: ["crm", "tasks"], invalid: [] });
    expect(sanitizeModules(["crm", "nope", "dashboard"])).toEqual({ valid: ["crm"], invalid: ["nope", "dashboard"] });
  });
});

describe("department access with hand-picked modules", () => {
  const user = (over: Record<string, unknown>) => ({
    role: { name: "EMPLOYEE" },
    department: { name: "Sales" },
    modulesCustomized: false,
    modules: [] as string[],
    ...over,
  });

  it("is unchanged for people without a custom list", () => {
    expect(hasDepartmentAccess(user({}), ["Sales"])).toBe(true);
    expect(hasDepartmentAccess(user({}), ["Recruitment"])).toBe(false);
  });

  it("lets a custom list override the department: a Sales person without CRM loses Sales APIs", () => {
    expect(hasDepartmentAccess(user({ modulesCustomized: true, modules: ["tasks", "chat"] }), ["Sales"])).toBe(false);
  });

  it("opens an area to someone outside that department when they are given a module in it", () => {
    const dev = user({ department: { name: "Dev" }, modulesCustomized: true, modules: ["crm"] });
    expect(hasDepartmentAccess(dev, ["Sales"])).toBe(true);
    expect(hasDepartmentAccess(dev, ["Recruitment"])).toBe(false);
  });

  it("treats shared APIs (Sales or Recruitment) as open to either area's modules", () => {
    expect(hasDepartmentAccess(user({ modulesCustomized: true, modules: ["recruitment"] }), ["Sales", "Recruitment"])).toBe(true);
    expect(moduleGrantsArea(["bulk-email"], ["Recruitment"])).toBe(true);
  });

  it("never restricts an Admin", () => {
    expect(hasDepartmentAccess({ role: { name: "ADMIN" }, modulesCustomized: true, modules: [] }, ["Sales"])).toBe(true);
  });

  it("matches department names the way the rest of the app does (Development == Dev)", () => {
    expect(moduleGrantsArea(["projects"], ["Dev"])).toBe(true);
    expect(moduleGrantsArea(["dev"], ["Development"])).toBe(true);
  });
});

describe("UsersService module access rules", () => {
  const as = (role: string) => ({ id: "x", role: { name: role } }) as unknown as RequestUser;
  const resolve = (dto: object, actor: RequestUser, current = { modulesCustomized: false }) =>
    (new UsersService({} as never) as unknown as {
      resolveModuleAccess: (d: object, a: RequestUser, c: object) => unknown;
    }).resolveModuleAccess(dto, actor, current);

  it("leaves module access alone when the request doesn't mention it", () => {
    expect(resolve({}, as("MANAGER"))).toEqual({});
  });

  it("lets only an Admin choose modules", () => {
    expect(() => resolve({ modulesCustomized: true, modules: ["crm"] }, as("MANAGER"))).toThrow(ForbiddenException);
    expect(resolve({ modulesCustomized: true, modules: ["tasks", "crm"] }, as("ADMIN"))).toEqual({
      modulesCustomized: true,
      modules: ["crm", "tasks"],
    });
  });

  it("clears the list when going back to the default, and rejects unknown modules", () => {
    expect(resolve({ modulesCustomized: false, modules: ["crm"] }, as("ADMIN"), { modulesCustomized: true })).toEqual({
      modulesCustomized: false,
      modules: [],
    });
    expect(() => resolve({ modulesCustomized: true, modules: ["nope"] }, as("ADMIN"))).toThrow(BadRequestException);
  });

  it("edits the list of someone already on a custom list without resending the flag", () => {
    expect(resolve({ modules: ["chat"] }, as("ADMIN"), { modulesCustomized: true })).toEqual({
      modulesCustomized: true,
      modules: ["chat"],
    });
  });
});
