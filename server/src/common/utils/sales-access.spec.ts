import { canUseIntentHiring, canUseSalesOrRecruitment, canUseSalesOutreach } from "./sales-access";
import type { RequestUser } from "../types/request-user.type";

const user = (role: string, department: string | null) =>
  ({
    id: "u",
    email: "u@x.com",
    firstName: "T",
    lastName: "U",
    role: { id: "r", name: role },
    department: department ? { id: "d", name: department, managerTitle: "Manager" } : null,
  }) as unknown as RequestUser;

describe("canUseSalesOutreach", () => {
  it("allows Admin and any Sales member, manager or not", () => {
    expect(canUseSalesOutreach(user("ADMIN", null))).toBe(true);
    expect(canUseSalesOutreach(user("EMPLOYEE", "Sales"))).toBe(true);
    expect(canUseSalesOutreach(user("MANAGER", "Sales"))).toBe(true);
  });

  it("denies everyone else", () => {
    expect(canUseSalesOutreach(user("EMPLOYEE", "Recruitment"))).toBe(false);
    expect(canUseSalesOutreach(user("MANAGER", "HR"))).toBe(false);
    expect(canUseSalesOutreach(user("EMPLOYEE", null))).toBe(false);
  });

  it("matches the Sales department name exactly (case-sensitive)", () => {
    expect(canUseSalesOutreach(user("EMPLOYEE", "sales"))).toBe(false);
  });
});

describe("canUseIntentHiring (Recruitment & Sales)", () => {
  it.each([
    "Recruitment",
    "recruitment",
    "  Recruitment  ",
    "Talent Recruitment",
    "Recruiting",
    "Sales",
    "sales",
    "Inside Sales",
    "Sales Department",
  ])("allows department %j", (dept) => {
    expect(canUseIntentHiring(user("EMPLOYEE", dept))).toBe(true);
    expect(canUseIntentHiring(user("MANAGER", dept))).toBe(true);
  });

  it("allows Admin regardless of department", () => {
    expect(canUseIntentHiring(user("ADMIN", null))).toBe(true);
    expect(canUseIntentHiring(user("ADMIN", "HR"))).toBe(true);
  });

  it.each(["HR", "Development", "Digital Marketing"])("denies department %j", (dept) => {
    expect(canUseIntentHiring(user("EMPLOYEE", dept))).toBe(false);
    expect(canUseIntentHiring(user("MANAGER", dept))).toBe(false);
  });

  it("denies a non-admin with no department", () => {
    expect(canUseIntentHiring(user("EMPLOYEE", null))).toBe(false);
  });
});

describe("canUseSalesOrRecruitment (gates Bulk Email)", () => {
  it("allows Sales, Recruitment and Admin", () => {
    expect(canUseSalesOrRecruitment(user("EMPLOYEE", "Sales"))).toBe(true);
    expect(canUseSalesOrRecruitment(user("EMPLOYEE", "Recruitment"))).toBe(true);
    expect(canUseSalesOrRecruitment(user("MANAGER", "Recruitment"))).toBe(true);
    expect(canUseSalesOrRecruitment(user("ADMIN", null))).toBe(true);
  });

  it("denies other departments and department-less users", () => {
    expect(canUseSalesOrRecruitment(user("EMPLOYEE", "HR"))).toBe(false);
    expect(canUseSalesOrRecruitment(user("MANAGER", "Development"))).toBe(false);
    expect(canUseSalesOrRecruitment(user("EMPLOYEE", null))).toBe(false);
  });
});
