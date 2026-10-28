import type { RoleName } from "@prisma/client";

export interface RequestUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: {
    id: string;
    name: RoleName;
  };
  // Drives department-scoped Manager permissions (see e.g.
  // TasksService.assertCanMutate). Null for users with no department set.
  department: {
    id: string;
    name: string;
    managerTitle: string;
  } | null;
  // Admin-granted permission to sign out; ADMIN role can always sign out. Optional so partial fixtures still type-check.
  canSignOut?: boolean;
  // Admin-chosen module access. When modulesCustomized is true, `modules` is the whole list they may use.
  modulesCustomized?: boolean;
  modules?: string[];
}
