import type { CurrentUser } from "@/stores/auth-store";

// UI-only gate mirroring the backend's canUseSalesOutreach (see
// server/src/common/utils/sales-access.ts) -- this hides the Call
// button/widget for non-Sales users, it is not itself the enforcement. Every
// telephony endpoint re-checks this server-side.
export function canUseCalling(user: Pick<CurrentUser, "role" | "department">): boolean {
  return user.role.name === "ADMIN" || user.department?.name === "Sales";
}
