import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AttendanceSettingsView } from "@/lib/api/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  view: undefined as unknown,
  isLoading: false,
  update: vi.fn(),
  setDept: vi.fn(),
  clearDept: vi.fn(),
  updateState: { isPending: false, isError: false, error: null as unknown },
}));

vi.mock("@/hooks/use-work-session", () => ({
  useAttendanceSettings: () => ({ data: mocks.view, isLoading: mocks.isLoading }),
  useUpdateAttendanceSettings: () => ({ mutate: mocks.update, ...mocks.updateState }),
  useSetDepartmentPolicy: () => ({ mutate: mocks.setDept, isPending: false, isError: false, error: null }),
  useClearDepartmentPolicy: () => ({ mutate: mocks.clearDept, isPending: false, isError: false, error: null }),
}));

import { AttendanceRulesSheet } from "./attendance-rules-sheet";

const defaults = {
  lateGraceMin: 10, earlyGraceMin: 5, idlePromptMin: 30, absentAfterMin: 60, maxOpenSessionHours: 14,
  repeatLateThreshold: 3, repeatLateWindowDays: 7, minWorkMinutes: 510, weeklyOffDays: [0, 6], absenceTrackingStart: null,
};

const makeView = (over: Partial<AttendanceSettingsView> = {}): AttendanceSettingsView => ({
  global: { ...defaults, lateGraceMin: 15, absenceTrackingStart: "2026-10-01" },
  defaults,
  limits: {
    lateGraceMin: [0, 180], earlyGraceMin: [0, 180], idlePromptMin: [5, 240], absentAfterMin: [15, 600],
    maxOpenSessionHours: [4, 24], repeatLateThreshold: [2, 30], repeatLateWindowDays: [1, 90], minWorkMinutes: [60, 1440],
  },
  departments: [{ id: "d1", name: "Recruitment" }, { id: "d2", name: "Sales" }],
  overrides: [],
  ...over,
});

let container: HTMLDivElement;
let root: Root;
const body = () => document.body;
const text = () => document.body.textContent ?? "";
const render = () => act(() => root.render(<AttendanceRulesSheet open onOpenChange={() => undefined} />));
const input = (id: string) => document.querySelector<HTMLInputElement>(`#${id}`)!;
const button = (label: string) =>
  Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent?.trim().startsWith(label))!;

function setValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(() => {
  mocks.view = makeView();
  mocks.isLoading = false;
  mocks.update.mockReset();
  mocks.setDept.mockReset();
  mocks.clearDept.mockReset();
  mocks.updateState = { isPending: false, isError: false, error: null };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  body().innerHTML = "";
});

describe("AttendanceRulesSheet — the company rules", () => {
  it("loads the stored rules into the form", () => {
    render();
    expect(input("r-late").value).toBe("15");
    expect(input("r-early").value).toBe("5");
    expect(input("r-idle").value).toBe("30");
    expect(input("r-absent").value).toBe("60");
    expect(input("r-min").value).toBe("8.5"); // stored as 510 minutes, shown as hours
    expect(input("r-max").value).toBe("14");
    expect(input("r-rep").value).toBe("3");
    expect(input("r-win").value).toBe("7");
    expect(input("r-track").value).toBe("2026-10-01");
  });

  it("highlights the weekly days off", () => {
    render();
    const pressed = Array.from(document.querySelectorAll<HTMLButtonElement>("button[aria-pressed='true']")).map((b) => b.textContent);
    expect(pressed).toEqual(["Sun", "Sat"]);
  });

  it("shows the built-in default beside each rule", () => {
    render();
    expect(text()).toContain("Default 10"); // late grace default
    expect(text()).toContain("Default 30");
  });

  it("Save is off until something changes", () => {
    render();
    expect(button("Save rules").disabled).toBe(true);
    setValue(input("r-late"), "20");
    expect(button("Save rules").disabled).toBe(false);
  });

  it("saves only valid edits, as numbers (hours become minutes)", () => {
    render();
    setValue(input("r-late"), "20");
    setValue(input("r-min"), "8");
    setValue(input("r-track"), "");
    act(() => button("Save rules").click());

    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update.mock.calls[0][0]).toMatchObject({
      lateGraceMin: 20,
      minWorkMinutes: 480,
      absenceTrackingStart: null,
      weeklyOffDays: [0, 6],
      idlePromptMin: 30,
    });
  });

  it("refuses an out-of-range or non-numeric value, naming the limits, and won't save", () => {
    render();
    setValue(input("r-idle"), "2");
    expect(text()).toContain("whole number from 5 to 240");
    expect(button("Save rules").disabled).toBe(true);
    act(() => button("Save rules").click());
    expect(mocks.update).not.toHaveBeenCalled();

    setValue(input("r-idle"), "abc");
    expect(button("Save rules").disabled).toBe(true);
    setValue(input("r-idle"), "45");
    expect(button("Save rules").disabled).toBe(false);
  });

  it("toggling a weekday changes the days off that get saved", () => {
    render();
    act(() => button("Sat").click()); // Saturday becomes a working day
    act(() => button("Fri").click()); // Friday becomes a day off
    act(() => button("Save rules").click());
    expect(mocks.update.mock.calls[0][0].weeklyOffDays).toEqual([0, 5]);
  });

  it("won't let every day be a day off", () => {
    render();
    for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri"]) act(() => button(day).click());
    expect(text()).toContain("At least one day of the week must be a working day");
    expect(button("Save rules").disabled).toBe(true);
  });

  it("'Fill in defaults' fills the form with the built-in values, ready to save", () => {
    render();
    act(() => button("Fill in defaults").click());
    expect(input("r-late").value).toBe("10");
    expect(input("r-track").value).toBe("");
    expect(button("Save rules").disabled).toBe(false);
  });

  it("shows the server's message if saving fails", () => {
    mocks.updateState = { isPending: false, isError: true, error: new Error("Only Admin and HR can view or change the attendance rules.") };
    render();
    expect(text()).toContain("Only Admin and HR can view or change");
  });

  it("shows a spinner while the rules load", () => {
    mocks.isLoading = true;
    mocks.view = undefined;
    render();
    expect(document.querySelector("svg.animate-spin")).not.toBeNull();
    expect(document.querySelector("#r-late")).toBeNull();
  });
});

describe("AttendanceRulesSheet — department differences", () => {
  const chooseDepartment = (name: string) => {
    // The department picker is a Radix Select; the sheet also renders override rows we can click.
    mocks.view = makeView({ overrides: [{ departmentId: "d1", departmentName: "Recruitment", lateGraceMin: 30, minWorkMinutes: null }] });
    render();
    act(() => button(name).click());
  };

  it("lists existing overrides with what differs", () => {
    mocks.view = makeView({ overrides: [{ departmentId: "d1", departmentName: "Recruitment", lateGraceMin: 30, minWorkMinutes: 480 }] });
    render();
    expect(text()).toContain("Late grace 30 min");
    expect(text()).toContain("Minimum per day 480 min");
  });

  it("clicking an override opens it for editing, with the company value as the placeholder", () => {
    chooseDepartment("Recruitment");
    expect(document.querySelector<HTMLInputElement>("#d-lateGraceMin")!.value).toBe("30");
    expect(document.querySelector<HTMLInputElement>("#d-earlyGraceMin")!.value).toBe("");
    expect(document.querySelector<HTMLInputElement>("#d-earlyGraceMin")!.placeholder).toBe("5");
  });

  it("saves the department's values, sending null for a blank field (back to the company value)", () => {
    chooseDepartment("Recruitment");
    setValue(document.querySelector<HTMLInputElement>("#d-lateGraceMin")!, "40");
    setValue(document.querySelector<HTMLInputElement>("#d-idlePromptMin")!, "45");
    act(() => button("Save for this department").click());
    expect(mocks.setDept).toHaveBeenCalledTimes(1);
    expect(mocks.setDept.mock.calls[0][0]).toEqual({
      departmentId: "d1",
      patch: { lateGraceMin: 40, earlyGraceMin: null, idlePromptMin: 45, absentAfterMin: null, minWorkMinutes: null },
    });
  });

  it("won't save an out-of-range department value", () => {
    chooseDepartment("Recruitment");
    setValue(document.querySelector<HTMLInputElement>("#d-idlePromptMin")!, "1");
    expect(button("Save for this department").disabled).toBe(true);
    act(() => button("Save for this department").click());
    expect(mocks.setDept).not.toHaveBeenCalled();
  });

  it("removes a department's differences", () => {
    mocks.view = makeView({ overrides: [{ departmentId: "d1", departmentName: "Recruitment", lateGraceMin: 30 }] });
    render();
    act(() => document.querySelector<HTMLButtonElement>('button[title="Remove Recruitment\'s differences"]')!.click());
    expect(mocks.clearDept).toHaveBeenCalledWith("d1");
  });
});
