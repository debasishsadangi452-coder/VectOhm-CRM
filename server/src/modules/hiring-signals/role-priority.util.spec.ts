import { scoreRolePriority } from "./role-priority.util";

describe("scoreRolePriority", () => {
  it("ranks a CEO above a VP Talent Acquisition", () => {
    expect(scoreRolePriority("CEO")).toBeGreaterThan(scoreRolePriority("VP Talent Acquisition"));
  });

  it("ranks a VP Talent Acquisition above a generic HR Manager", () => {
    expect(scoreRolePriority("VP Talent Acquisition")).toBeGreaterThan(scoreRolePriority("HR Manager"));
  });

  it("is case-insensitive", () => {
    expect(scoreRolePriority("chief executive officer")).toBe(scoreRolePriority("Chief Executive Officer"));
  });

  it("falls back to a low score for an unrecognized title", () => {
    expect(scoreRolePriority("Staff Software Engineer")).toBe(40);
  });

  it("falls back to the lowest score for a missing title", () => {
    expect(scoreRolePriority(null)).toBe(10);
    expect(scoreRolePriority(undefined)).toBe(10);
    expect(scoreRolePriority("")).toBe(10);
  });
});
