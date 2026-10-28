import { RoleName } from "@prisma/client";
import type { RequestUser } from "../types/request-user.type";

// The HR department is the one team with company-wide people-management
// authority: creating/editing employees and managing departments. Everyone
// else (except Admin) is read-only on the directory.
//
// Identified by department name, which is consistent with how the rest of the
// app identifies departments -- nav filtering (app-sidebar) and role labels
// both key off the department name, and these names are stable seeded
// fixtures. Admin is always a global override.
export const DIRECTORY_DEPARTMENT = "HR";

export function isHrUser(user: RequestUser): boolean {
  const name = (user.department?.name || "").toLowerCase().trim();
  return name === "hr" || name.includes("human resource");
}

export function canManageDirectory(user: RequestUser): boolean {
  return user.role.name === RoleName.ADMIN || isHrUser(user);
}
