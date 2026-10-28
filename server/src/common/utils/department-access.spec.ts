import { hasDepartmentAccess } from "./department-access";

const user = (role: string, dept?: string | null) =>
  ({ role: { name: role }, department: dept === undefined ? null : { name: dept } }) as any;

describe("hasDepartmentAccess", () => {
  it("admin always passes", () => {
    expect(hasDepartmentAccess(user("ADMIN"), ["Sales"])).toBe(true);
  });

  it("matches the user's own department, including aliases", () => {
    expect(hasDepartmentAccess(user("EMPLOYEE", "Sales"), ["Sales"])).toBe(true);
    expect(hasDepartmentAccess(user("EMPLOYEE", "Sales & Marketing"), ["Sales"])).toBe(true);
    expect(hasDepartmentAccess(user("EMPLOYEE", "Human Resources"), ["HR"])).toBe(true);
    expect(hasDepartmentAccess(user("EMPLOYEE", "Development"), ["Dev"])).toBe(true);
    expect(hasDepartmentAccess(user("EMPLOYEE", "Recruitment"), ["Sales", "Recruitment"])).toBe(true);
  });

  it("rejects other departments", () => {
    expect(hasDepartmentAccess(user("MANAGER", "Development"), ["Sales"])).toBe(false);
    expect(hasDepartmentAccess(user("EMPLOYEE", "Recruitment"), ["Sales"])).toBe(false);
  });

  it("rejects a non-admin with no department (an empty name used to match everything)", () => {
    expect(hasDepartmentAccess(user("EMPLOYEE", null), ["Sales"])).toBe(false);
    expect(hasDepartmentAccess(user("MANAGER", ""), ["Recruitment"])).toBe(false);
    expect(hasDepartmentAccess(null, ["Sales"])).toBe(false);
  });
});
