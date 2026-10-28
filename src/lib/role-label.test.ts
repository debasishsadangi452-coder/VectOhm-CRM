import { describe, expect, it } from "vitest";
import { getRoleLabel } from "./role-label";

describe("getRoleLabel", () => {
  it("ADMIN is always just 'Admin', ignoring department entirely", () => {
    expect(
      getRoleLabel({
        role: { id: "r1", name: "ADMIN" },
        department: { id: "d1", name: "Sales", managerTitle: "Sales Manager" },
      }),
    ).toBe("Admin");
    expect(getRoleLabel({ role: { id: "r1", name: "ADMIN" }, department: null })).toBe("Admin");
  });

  it("MANAGER uses the department's custom managerTitle when set", () => {
    expect(
      getRoleLabel({
        role: { id: "r2", name: "MANAGER" },
        department: { id: "d1", name: "Engineering", managerTitle: "Dev Head" },
      }),
    ).toBe("Engineering Dev Head");
  });

  it("MANAGER falls back to the generic 'Manager' label when managerTitle is null/undefined", () => {
    expect(
      getRoleLabel({
        role: { id: "r2", name: "MANAGER" },
        department: { id: "d1", name: "Sales", managerTitle: undefined as unknown as string },
      }),
    ).toBe("Sales Manager");
  });

  // Documents actual current behavior, not necessarily ideal behavior: the
  // fallback is `?? "Manager"` (nullish coalescing), which does NOT catch an
  // empty string -- a department seeded with managerTitle: "" renders with a
  // trailing space instead of falling back. Pinning this so a future change
  // to either the seed data or getRoleLabel is a deliberate choice, not a
  // silent regression.
  it("does NOT fall back for an empty-string managerTitle (only null/undefined trigger the default)", () => {
    expect(
      getRoleLabel({
        role: { id: "r2", name: "MANAGER" },
        department: { id: "d1", name: "Sales", managerTitle: "" },
      }),
    ).toBe("Sales ");
  });

  it("EMPLOYEE is always labeled 'Employee' regardless of managerTitle", () => {
    expect(
      getRoleLabel({
        role: { id: "r3", name: "EMPLOYEE" },
        department: { id: "d1", name: "Sales", managerTitle: "Sales Manager" },
      }),
    ).toBe("Sales Employee");
  });

  it("falls back to 'Unassigned' when a non-admin has no department", () => {
    expect(getRoleLabel({ role: { id: "r3", name: "EMPLOYEE" }, department: null })).toBe(
      "Unassigned Employee",
    );
  });
});
