import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserSummary } from "@/lib/api/types";
import { filterPeople, FALLBACK_SHIFT_PRESETS } from "@/lib/shift-templates";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  templates: [] as Array<{ id: string; name: string; shiftStart: string; shiftEnd: string }>,
  users: [] as unknown[],
  create: vi.fn(),
  remove: vi.fn(),
  apply: vi.fn(),
  createState: { isPending: false, isError: false, error: null as unknown },
}));

vi.mock("@/hooks/use-work-session", () => ({
  useShiftTemplates: () => ({ data: mocks.templates, isLoading: false }),
  useCreateShiftTemplate: () => ({ mutate: mocks.create, ...mocks.createState }),
  useDeleteShiftTemplate: () => ({ mutate: mocks.remove, isPending: false, isError: false, error: null }),
  useApplyShiftTemplate: () => ({ mutate: mocks.apply, isPending: false, isError: false, error: null }),
}));
vi.mock("@/hooks/use-users", () => ({ useUsers: () => ({ data: mocks.users }) }));

import { ShiftTemplatesDialog } from "./shift-templates-dialog";

const user = (id: string, first: string, department: string | null, over: Partial<UserSummary> = {}): UserSummary =>
  ({
    id,
    email: `${first.toLowerCase()}@x.com`,
    firstName: first,
    lastName: "Person",
    avatarUrl: null,
    githubUsername: null,
    isActive: true,
    monthlyTarget: null,
    shiftStart: "10:00",
    shiftEnd: "19:00",
    role: { id: "r", name: "EMPLOYEE" },
    department: department ? { id: `d-${department}`, name: department } : null,
    manager: null,
    ...over,
  }) as unknown as UserSummary;

// ───────────────────────── filterPeople ─────────────────────────

describe("filterPeople", () => {
  const people = [
    user("1", "Zed", "Sales"),
    user("2", "Amy", "Recruitment"),
    user("3", "Bob", "Sales", { isActive: false }),
    user("4", "Cat", null),
  ];

  it("lists only active accounts, A-Z by name", () => {
    expect(filterPeople(people, { search: "", department: "__all__" }).map((p) => p.firstName)).toEqual(["Amy", "Cat", "Zed"]);
  });
  it("filters by department name", () => {
    expect(filterPeople(people, { search: "", department: "Sales" }).map((p) => p.firstName)).toEqual(["Zed"]);
  });
  it("searches name or email, case-insensitively", () => {
    expect(filterPeople(people, { search: "  AMY ", department: "__all__" }).map((p) => p.firstName)).toEqual(["Amy"]);
    expect(filterPeople(people, { search: "cat@x", department: "__all__" }).map((p) => p.firstName)).toEqual(["Cat"]);
  });
  it("combines search and department", () => {
    expect(filterPeople(people, { search: "amy", department: "Sales" })).toEqual([]);
  });
  it("does not change the list it was given", () => {
    const copy = [...people];
    filterPeople(people, { search: "", department: "__all__" });
    expect(people).toEqual(copy);
  });
});

describe("FALLBACK_SHIFT_PRESETS", () => {
  it("offers the old quick picks plus a night shift until HR makes templates", () => {
    expect(FALLBACK_SHIFT_PRESETS.map((p) => `${p.shiftStart}-${p.shiftEnd}`)).toEqual([
      "09:00-18:00",
      "09:30-18:30",
      "10:00-19:00",
      "11:00-20:00",
      "22:00-06:00",
    ]);
  });

  it("the night preset crosses midnight (end before start) on purpose", () => {
    const night = FALLBACK_SHIFT_PRESETS.find((p) => p.name.startsWith("Night"))!;
    expect(night.shiftEnd < night.shiftStart).toBe(true);
  });
});

// ───────────────────────── the dialog ─────────────────────────

let container: HTMLDivElement;
let root: Root;
const text = () => document.body.textContent ?? "";
const render = () => act(() => root.render(<ShiftTemplatesDialog open onOpenChange={() => undefined} />));
const button = (label: string) =>
  Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent?.trim().startsWith(label))!;
const checkbox = (label: string) => document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;

function setValue(selector: string, value: string) {
  const el = document.querySelector<HTMLInputElement>(selector)!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(() => {
  mocks.templates = [{ id: "t1", name: "9-6 Sales", shiftStart: "09:00", shiftEnd: "18:00" }];
  mocks.users = [user("u1", "Amy", "Sales"), user("u2", "Bea", "Sales"), user("u3", "Cy", "Recruitment")];
  mocks.create.mockReset();
  mocks.remove.mockReset();
  mocks.apply.mockReset();
  mocks.createState = { isPending: false, isError: false, error: null };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
});

describe("ShiftTemplatesDialog — templates", () => {
  it("lists the templates with their hours", () => {
    render();
    expect(text()).toContain("9-6 Sales");
    expect(text()).toContain("09:00–18:00");
  });

  it("adds a template with a trimmed name", () => {
    render();
    setValue("#tpl-name", "  Night shift  ");
    setValue("#tpl-start", "22:00");
    setValue("#tpl-end", "06:00");
    act(() => button("Add").click());
    expect(mocks.create.mock.calls[0][0]).toEqual({ name: "Night shift", shiftStart: "22:00", shiftEnd: "06:00" });
  });

  it("can't add without a name, or with identical start and end", () => {
    render();
    expect(button("Add").disabled).toBe(true);
    setValue("#tpl-name", "Day");
    expect(button("Add").disabled).toBe(false);
    setValue("#tpl-end", "09:00"); // equals the default start
    expect(button("Add").disabled).toBe(true);
  });

  it("deletes a template", () => {
    render();
    act(() => document.querySelector<HTMLButtonElement>('button[title="Delete 9-6 Sales"]')!.click());
    expect(mocks.remove).toHaveBeenCalledWith("t1");
  });

  it("shows the server's reason when adding fails", () => {
    mocks.createState = { isPending: false, isError: true, error: new Error('A template called "Day" already exists.') };
    render();
    expect(text()).toContain("already exists");
  });

  it("says so when there are no templates, and hides the apply section", () => {
    mocks.templates = [];
    render();
    expect(text()).toContain("No templates yet");
    expect(text()).not.toContain("Apply to people");
  });
});

describe("ShiftTemplatesDialog — applying to people", () => {
  it("lists active people with their current hours, nobody picked at first", () => {
    render();
    expect(text()).toContain("Amy Person");
    expect(text()).toContain("Cy Person");
    expect(checkbox("Amy Person").checked).toBe(false);
  });

  it("the apply button is off until a template and people are chosen", () => {
    render();
    const apply = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent?.trim() === "Choose a template")!;
    expect(apply.disabled).toBe(true);
  });

  it("'Select everyone shown' picks them all, and again clears them", () => {
    render();
    act(() => checkbox("Select everyone shown").click());
    expect(checkbox("Amy Person").checked && checkbox("Bea Person").checked && checkbox("Cy Person").checked).toBe(true);
    act(() => checkbox("Select everyone shown").click());
    expect(checkbox("Amy Person").checked).toBe(false);
  });

  it("searching narrows the list, and select-all then only picks those shown", () => {
    render();
    setValue('input[placeholder="Search people…"]', "amy");
    expect(text()).not.toContain("Cy Person");
    act(() => checkbox("Select everyone shown").click());
    setValue('input[placeholder="Search people…"]', "");
    expect(checkbox("Amy Person").checked).toBe(true);
    expect(checkbox("Cy Person").checked).toBe(false);
  });
});
