import { EmailTemplateVisibility, RoleName } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import type { RequestUser } from "../../common/types/request-user.type";

/**
 * Which templates a person can see and use: their own, everything shared with everyone, and what was shared
 * with their department. An Admin sees them all.
 */
export function templateVisibleTo(user: RequestUser): Prisma.EmailTemplateWhereInput {
  if (user.role.name === RoleName.ADMIN) return {};
  return {
    OR: [
      { creatorId: user.id },
      { visibility: EmailTemplateVisibility.EVERYONE },
      ...(user.department
        ? [{ visibility: EmailTemplateVisibility.DEPARTMENT, departmentId: user.department.id }]
        : []),
    ],
  };
}

/** Only the person who made a template (or an Admin) can change or delete it. */
export function canEditTemplate(template: { creatorId: string }, user: RequestUser): boolean {
  return user.role.name === RoleName.ADMIN || template.creatorId === user.id;
}
