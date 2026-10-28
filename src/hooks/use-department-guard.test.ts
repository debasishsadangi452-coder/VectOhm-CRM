import { describe, expect, it, vi } from "vitest";

// The hook file imports the router and auth store; only the pure matcher is
// under test here, so stub them out.
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/stores/auth-store", () => ({ useAuthStore: vi.fn() }));

import { isDepartmentMatch } from "./use-department-guard";

describe("isDepartmentMatch", () => {
  it("is false when either side is missing or empty", () => {
    expect(isDepartmentMatch(undefined, "Sales")).toBe(false);
    expect(isDepartmentMatch(null, "Sales")).toBe(false);
    expect(isDepartmentMatch("", "Sales")).toBe(false);
    expect(isDepartmentMatch("Sales", undefined)).toBe(false);
    expect(isDepartmentMatch("Sales", "")).toBe(false);
  });

  it("matches case-insensitively and ignores surrounding space", () => {
    expect(isDepartmentMatch("  SALES ", "sales")).toBe(true);
    expect(isDepartmentMatch("Recruitment", "recruitment")).toBe(true);
  });

  describe("Recruitment (Intent Hiring + Bulk Email)", () => {
    it.each(["Recruitment", "Talent Recruitment", "Recruiting", "recruiters & recruitment"])("matches %j", (dept) => {
      expect(isDepartmentMatch(dept, "Recruitment")).toBe(true);
    });
    it.each(["Sales", "HR", "Development", "Digital Marketing"])("does not match %j", (dept) => {
      expect(isDepartmentMatch(dept, "Recruitment")).toBe(false);
    });
  });

  describe("Sales", () => {
    it.each(["Sales", "Inside Sales", "sales team"])("matches %j", (dept) => {
      expect(isDepartmentMatch(dept, "Sales")).toBe(true);
    });
    it("does not match Recruitment", () => {
      expect(isDepartmentMatch("Recruitment", "Sales")).toBe(false);
    });
  });

  describe("aliases", () => {
    it("treats HR and Human Resources as the same department", () => {
      expect(isDepartmentMatch("HR", "Human Resources")).toBe(true);
      expect(isDepartmentMatch("Human Resources", "hr")).toBe(true);
    });
    it("treats Dev and Development as the same department", () => {
      expect(isDepartmentMatch("Dev", "Development")).toBe(true);
      expect(isDepartmentMatch("Development", "dev")).toBe(true);
    });
    it("treats Marketing and SEO as the same department", () => {
      expect(isDepartmentMatch("SEO", "Digital Marketing")).toBe(true);
      expect(isDepartmentMatch("Digital Marketing", "SEO")).toBe(true);
    });
  });

  it("does not match unrelated departments", () => {
    expect(isDepartmentMatch("HR", "Sales")).toBe(false);
    expect(isDepartmentMatch("Development", "Recruitment")).toBe(false);
  });
});
