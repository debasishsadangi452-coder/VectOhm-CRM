import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { DepartmentGuard } from "./department.guard";
import { DEPARTMENT_KEY } from "../decorators/department.decorator";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

type TestUser = { role?: { name: string }; department?: { name?: string; code?: string } | null } | null;

function run(user: TestUser, metadata: { departments?: string[]; isPublic?: boolean }) {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) => {
      if (key === IS_PUBLIC_KEY) return metadata.isPublic;
      if (key === DEPARTMENT_KEY) return metadata.departments;
      return undefined;
    }),
  };
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  return new DepartmentGuard(reflector as never).canActivate(context);
}

const employee = (department: string | null): TestUser => ({
  role: { name: "EMPLOYEE" },
  department: department ? { name: department } : null,
});

// The controller behind the Recruitment > Bulk Email page.
const BULK_EMAIL = { departments: ["Sales", "Recruitment"] };

describe("DepartmentGuard", () => {
  it("lets everyone through when no department is required", () => {
    expect(run(employee("HR"), {})).toBe(true);
    expect(run(employee("HR"), { departments: [] })).toBe(true);
  });

  it("lets public routes through", () => {
    expect(run(null, { isPublic: true, departments: ["Sales"] })).toBe(true);
  });

  it("requires an authenticated user", () => {
    expect(() => run(null, BULK_EMAIL)).toThrow(ForbiddenException);
  });

  it("always lets an Admin through", () => {
    expect(run({ role: { name: "ADMIN" }, department: null }, BULK_EMAIL)).toBe(true);
  });

  describe("Bulk Email (Sales + Recruitment)", () => {
    it.each(["Sales", "sales", "  Sales  ", "Sales Team", "Inside Sales", "Recruitment", "recruitment", "Talent Recruitment", "Recruiting"])(
      "allows department %j",
      (dept) => {
        expect(run(employee(dept), BULK_EMAIL)).toBe(true);
      },
    );

    it.each(["HR", "Human Resources", "Development", "Dev", "Digital Marketing", "SEO", "Executive"])(
      "denies department %j",
      (dept) => {
        expect(() => run(employee(dept), BULK_EMAIL)).toThrow(ForbiddenException);
      },
    );

    it("names the allowed and actual departments in the error", () => {
      expect(() => run(employee("HR"), BULK_EMAIL)).toThrow(
        "Access denied: This resource belongs to [Sales, Recruitment]. Your department is [HR].",
      );
    });

    it("applies to Managers too (the role doesn't override the department)", () => {
      expect(() => run({ role: { name: "MANAGER" }, department: { name: "Development" } }, BULK_EMAIL)).toThrow(
        ForbiddenException,
      );
      expect(run({ role: { name: "MANAGER" }, department: { name: "Recruitment" } }, BULK_EMAIL)).toBe(true);
    });
  });

  it("matches on the department code when the name doesn't normalise", () => {
    expect(run({ role: { name: "EMPLOYEE" }, department: { name: "", code: "Sales" } }, BULK_EMAIL)).toBe(true);
  });

  // Fixed: a user with NO department used to pass every department-scoped route,
  // because `target.includes(userDeptName)` is true for an empty string.
  it("denies a user who has no department", () => {
    expect(() => run(employee(null), BULK_EMAIL)).toThrow(ForbiddenException);
  });
});
