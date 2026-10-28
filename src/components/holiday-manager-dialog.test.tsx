import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  calendar: { weeklyOffDays: [0, 6], holidays: [] as Array<{ id: string; date: string; name: string }> },
  isLoading: false,
  createMutate: vi.fn(),
  deleteMutate: vi.fn(),
  createState: { isPending: false, isError: false, error: null as unknown },
}));

vi.mock("@/hooks/use-work-session", () => ({
  useAttendanceCalendar: () => ({ data: mocks.calendar, isLoading: mocks.isLoading }),
  useCreateHoliday: () => ({ mutate: mocks.createMutate, ...mocks.createState }),
  useDeleteHoliday: () => ({ mutate: mocks.deleteMutate, isPending: false, isError: false, error: null }),
}));

import { HolidayManagerDialog } from "./holiday-manager-dialog";

let container: HTMLDivElement;
let root: Root;

// Radix renders the dialog in a portal on <body>, not inside our container.
const body = () => document.body;
const text = () => document.body.textContent ?? "";
const addButton = () => Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent === "Add")!;

function setInput(selector: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(selector)!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const render = () => act(() => root.render(<HolidayManagerDialog open onOpenChange={() => undefined} />));

beforeEach(() => {
  mocks.calendar = { weeklyOffDays: [0, 6], holidays: [] };
  mocks.isLoading = false;
  mocks.createMutate.mockReset();
  mocks.deleteMutate.mockReset();
  mocks.createState = { isPending: false, isError: false, error: null };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  body().innerHTML = "";
});

describe("HolidayManagerDialog", () => {
  it("explains that nobody is marked late or absent, and names the weekly days off", () => {
    render();
    expect(text()).toContain("No one is marked late or absent");
    expect(text()).toContain("Every Sunday and Saturday is already a day off");
  });

  it("says so when there are no holidays", () => {
    render();
    expect(text()).toContain("No holidays added yet");
  });

  it("lists holidays with their dates", () => {
    mocks.calendar.holidays = [
      { id: "h1", date: "2026-10-20", name: "Diwali" },
      { id: "h2", date: "2026-12-25", name: "Christmas" },
    ];
    render();
    expect(text()).toContain("Diwali");
    expect(text()).toContain("Christmas");
    expect(text()).toMatch(/20 Oct,? 2026/);
  });

  it("shows a spinner while loading, not 'no holidays'", () => {
    mocks.isLoading = true;
    render();
    expect(text()).not.toContain("No holidays added yet");
  });

  it("can't add until there is both a date and a real name", () => {
    render();
    expect(addButton().disabled).toBe(true);
    setInput("#holiday-date", "2026-10-20");
    expect(addButton().disabled).toBe(true);
    setInput("#holiday-name", "D");
    expect(addButton().disabled).toBe(true);
    setInput("#holiday-name", "Diwali");
    expect(addButton().disabled).toBe(false);
  });

  it("adds the holiday with a trimmed name, then clears the form", () => {
    render();
    setInput("#holiday-date", "2026-10-20");
    setInput("#holiday-name", "  Diwali  ");
    act(() => addButton().click());

    expect(mocks.createMutate).toHaveBeenCalledTimes(1);
    const [input, options] = mocks.createMutate.mock.calls[0];
    expect(input).toEqual({ date: "2026-10-20", name: "Diwali" });

    act(() => options.onSuccess());
    expect(document.querySelector<HTMLInputElement>("#holiday-date")!.value).toBe("");
    expect(document.querySelector<HTMLInputElement>("#holiday-name")!.value).toBe("");
  });

  it("shows the server's reason when adding fails (e.g. duplicate day)", () => {
    mocks.createState = { isPending: false, isError: true, error: new Error("2026-10-20 is already a holiday (Diwali).") };
    render();
    expect(text()).toContain("already a holiday (Diwali)");
  });

  it("removes a holiday", () => {
    mocks.calendar.holidays = [{ id: "h1", date: "2026-10-20", name: "Diwali" }];
    render();
    document.querySelector<HTMLButtonElement>('button[title="Remove Diwali"]')!.click();
    expect(mocks.deleteMutate).toHaveBeenCalledWith("h1");
  });
});
