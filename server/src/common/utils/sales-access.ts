import { RoleName } from "@prisma/client";
import type { RequestUser } from "../types/request-user.type";

// Email outreach (Apollo search/import/enrich, templates, sequences) is a
// Sales-team tool -- every Sales department member gets access, not just
// managers, mirroring how canManageDirectory scopes HR by department name.
// Admin is always a global override.
export const SALES_OUTREACH_DEPARTMENT = "Sales";
export const RECRUITMENT_DEPARTMENT = "Recruitment";

export function canUseSalesOutreach(user: RequestUser): boolean {
  return user.role.name === RoleName.ADMIN || user.department?.name === SALES_OUTREACH_DEPARTMENT;
}

export function canUseIntentHiring(user: RequestUser): boolean {
  if (user.role.name === RoleName.ADMIN) return true;
  const dept = user.department?.name?.toLowerCase().trim() || "";
  return (
    dept === "recruitment" ||
    dept.includes("recruit") ||
    dept === "sales" ||
    dept.includes("sales")
  );
}

export function canUseSalesOrRecruitment(user: RequestUser): boolean {
  return canUseSalesOutreach(user) || canUseIntentHiring(user);
}
