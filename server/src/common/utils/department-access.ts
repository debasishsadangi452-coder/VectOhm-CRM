import { RoleName } from "@prisma/client";
import { MODULES } from "./modules";

interface DepartmentUser {
  role?: { name?: string } | null;
  modulesCustomized?: boolean | null;
  modules?: string[] | null;
  department?: { name?: string | null; code?: string | null } | null;
}

export function normalize(name: string): string {
  if (name === "hr" || name.includes("human resource")) return "hr";
  if (name === "dev" || name.includes("develop")) return "dev";
  if (name.includes("sales")) return "sales";
  if (name.includes("recruit")) return "recruitment";
  if (name.includes("marketing") || name.includes("seo")) return "marketing";
  return name;
}

// Shared by DepartmentGuard (HTTP routes) and the AI assistant's tools, so both
// apply exactly the same rule. Admin always passes. Someone with no department
// never does -- an empty name must not "include"-match every required department.
/** True if any module in `modules` belongs to one of the required departments' API areas. */
export function moduleGrantsArea(modules: string[], required: string[]): boolean {
  const wanted = required.map((d) => normalize(d.toLowerCase().trim()));
  return MODULES.some(
    (m) =>
      modules.includes(m.key) && (m.areas ?? []).some((a) => wanted.includes(normalize(a.toLowerCase().trim()))),
  );
}

export function hasDepartmentAccess(user: DepartmentUser | null | undefined, required: string[]): boolean {
  if (!user) return false;
  if (user.role?.name === RoleName.ADMIN) return true;
  if (required.length === 0) return true;

  // An Admin chose this person's modules by hand: that list decides, not their department.
  if (user.modulesCustomized) return moduleGrantsArea(user.modules ?? [], required);

  const userDeptName = (user.department?.name || "").toLowerCase().trim();
  const userDeptCode = (user.department?.code || "").toLowerCase().trim();
  if (!userDeptName && !userDeptCode) return false;
  const normalizedUserDept = normalize(userDeptName) || normalize(userDeptCode);

  return required.some((dept) => {
    const target = dept.toLowerCase().trim();
    return (
      normalizedUserDept === normalize(target) ||
      userDeptName === target ||
      userDeptCode === target ||
      (!!userDeptName && (userDeptName.includes(target) || target.includes(userDeptName)))
    );
  });
}
