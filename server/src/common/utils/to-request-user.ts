import type { Department, Role, User } from "@prisma/client";
import type { RequestUser } from "../types/request-user.type";

type UserWithRoleAndDepartment = User & { role: Role; department: Department | null };

// Three call sites (JwtStrategy, AuthService.validateCredentials,
// AuthService.refresh) each load a User with its Role and Department and need
// to shape it into a RequestUser -- centralized here so all three stay in sync.
export function toRequestUser(user: UserWithRoleAndDepartment): RequestUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: { id: user.role.id, name: user.role.name },
    canSignOut: user.canSignOut,
    modulesCustomized: user.modulesCustomized,
    modules: user.modules,
    department: user.department
      ? { id: user.department.id, name: user.department.name, managerTitle: user.department.managerTitle }
      : null,
  };
}
