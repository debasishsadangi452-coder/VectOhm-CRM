import type { CurrentUser } from "@/stores/auth-store";

// Job-title-style label combining Role tier + Department, e.g. "Sales Manager",
// "Dev Head" (Department.managerTitle overrides the default "Manager" label),
// "Sales Employee". ADMIN ignores department -- always just "Admin".
export function getRoleLabel(user: Pick<CurrentUser, "role" | "department">): string {
  if (user.role.name === "ADMIN") {
    return "Admin";
  }
  const departmentName = user.department?.name ?? "Unassigned";
  const tierLabel = user.role.name === "MANAGER" ? (user.department?.managerTitle ?? "Manager") : "Employee";
  return `${departmentName} ${tierLabel}`;
}
