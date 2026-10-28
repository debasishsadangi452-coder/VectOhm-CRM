import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/auth-store";
import { hasAreaAccess } from "@/lib/modules";
import { isDepartmentMatch } from "@/lib/department-match";

interface DepartmentGuardOptions {
  managerOnly?: boolean;
}

// Deliberately a component-level effect, not a route `beforeLoad` guard --
// beforeLoad isn't guaranteed to re-run client-side for the route already
// active during initial hydration (see _app.tsx's auth guard for the same
// lesson learned the hard way). This is UX only: it redirects away from a
// page that would otherwise render empty/filtered data. The actual boundary
// is the backend's department-scoped reads.
// The matching rules live in their own file so lib/modules.ts can use them without importing this hook.
export { isDepartmentMatch } from "@/lib/department-match";

export function useDepartmentGuard(departmentName: string | string[], options?: DepartmentGuardOptions) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) return;
    const isAdmin = user.role.name === "ADMIN";
    const targets = Array.isArray(departmentName) ? departmentName : [departmentName];
    // Someone whose modules were picked by hand is judged by those (see hasAreaAccess), not their department.
    const departmentOk = isAdmin || targets.some((t) => hasAreaAccess(user, t));
    const tierOk = !options?.managerOnly || isAdmin || user.role.name === "MANAGER";
    if (!departmentOk || !tierOk) {
      navigate({ to: "/" });
    }
  }, [user, navigate, departmentName, options?.managerOnly]);
}

// Inverse of useDepartmentGuard -- bounces one specific department away from
// a route that's otherwise open to everyone else (e.g. Sales has no use for
// Projects). Admin is always exempt, same as above.
export function useDepartmentExcludedGuard(excludedDepartment: string) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) return;
    const isAdmin = user.role.name === "ADMIN";
    if (!isAdmin && isDepartmentMatch(user.department?.name, excludedDepartment)) {
      navigate({ to: "/" });
    }
  }, [user, navigate, excludedDepartment]);
}
