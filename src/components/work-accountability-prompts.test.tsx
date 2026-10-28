import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkSession } from "@/lib/api/types";

// React needs this flag to treat act() as a real test environment.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  session: null as unknown,
  pending: null as unknown,
  lateMutate: vi.fn(),
  correctionMutate: vi.fn(),
}));

vi.mock("@/hooks/use-work-session", () => ({
  useActiveWorkSession: () => ({ data: mocks.session }),
  useSubmitLateReason: () => ({ mutate: mocks.lateMutate, isPending: false, isError: false }),
  usePendingCorrection: () => ({ data: mocks.pending }),
  useSubmitCorrection: () => ({ mutate: mocks.correctionMutate, isPending: false, isError: false }),
}));

import { WorkAccountabilityPrompts } from "./work-accountability-prompts";

const MIN = 60_000;

function makeSession(over: Partial<WorkSession> = {}): WorkSession {
  return {
    id: "s1",
    userId: "u1",
    clockInAt: new Date().toISOString(),
    clockOutAt: null,
    durationMin: null,
    date: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lateByMin: null,
    lateReason: null,
    isOnBreak: false,
    idlePromptMinutes: 30,
    ...over,
  };
}

let container: HTMLDivElement;
let root: Root;

function render() {
  act(() => root.render(<WorkAccountabilityPrompts />));
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function type(value: string) {
  const textarea = container.querySelector("textarea")!;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  act(() => {
    setter.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function setInput(selector: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(selector)!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const buttonByText = (text: string) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent?.trim() === text)!;

const submitButton = () => container.querySelector<HTMLButtonElement>('button[type="submit"]')!;
const dialogText = () => container.textContent ?? "";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-05T05:00:00Z"));
  mocks.session = null;
  mocks.pending = null;
  mocks.lateMutate.mockReset();
  mocks.correctionMutate.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("WorkAccountabilityPrompts — late clock-in", () => {
  it("renders nothing when not clocked in", () => {
    render();
    expect(container.innerHTML).toBe("");
  });

  it("asks why when the session is late and unanswered", () => {
    mocks.session = makeSession({ lateByMin: 25 });
    render();
    expect(dialogText()).toContain("You clocked in late");
    expect(dialogText()).toContain("25 min");
  });

  it("does not ask when the late reason was already given", () => {
    mocks.session = makeSession({ lateByMin: 25, lateReason: "Traffic" });
    render();
    expect(container.innerHTML).toBe("");
  });

  it("does not ask for an on-time session", () => {
    mocks.session = makeSession({ lateByMin: null });
    render();
    expect(container.innerHTML).toBe("");
  });

  it("blocks submit until a real reason is typed, then submits it trimmed", () => {
    mocks.session = makeSession({ lateByMin: 25 });
    render();
    expect(submitButton().disabled).toBe(true);

    type("ab");
    expect(submitButton().disabled).toBe(true);

    type("  Traffic jam  ");
    expect(submitButton().disabled).toBe(false);
    act(() => submitButton().click());
    expect(mocks.lateMutate).toHaveBeenCalledWith({ sessionId: "s1", reason: "Traffic jam" });
  });

  it("fills the textarea from a quick-reason chip", () => {
    mocks.session = makeSession({ lateByMin: 25 });
    render();
    const chip = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (b) => b.textContent === "Traffic / commute",
    )!;
    act(() => chip.click());
    expect(container.querySelector("textarea")!.value).toBe("Traffic / commute");
    expect(submitButton().disabled).toBe(false);
  });

  it("cannot be dismissed with Escape or a backdrop click", () => {
    mocks.session = makeSession({ lateByMin: 25 });
    render();
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      container.querySelector('[role="dialog"]')!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(dialogText()).toContain("You clocked in late");
  });
});

describe("WorkAccountabilityPrompts — idle", () => {
  // Idle means no keyboard or mouse input anywhere on the computer. A browser tab can't
  // see that, so the website never asks -- the desktop app does, from the OS idle time.
  it("never asks about idle time, however long the CRM tab sits untouched", () => {
    mocks.session = makeSession();
    render();
    advance(2 * 60 * MIN);
    vi.setSystemTime(Date.now() + 90 * MIN);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    });
    expect(container.innerHTML).toBe("");
  });
});

describe("WorkAccountabilityPrompts — forgotten clock-out correction", () => {
  // The session was opened 15h ago and closed automatically 6h ago.
  const autoClosed = () => {
    const clockIn = new Date(Date.now() - 15 * 60 * MIN);
    const closedAt = new Date(Date.now() - 6 * 60 * MIN);
    return makeSession({
      id: "old1",
      clockInAt: clockIn.toISOString(),
      clockOutAt: closedAt.toISOString(),
      autoClosed: true,
    });
  };

  it("asks when an auto-closed session still needs correcting, even when not clocked in", () => {
    mocks.session = null;
    mocks.pending = autoClosed();
    render();
    expect(dialogText()).toContain("You didn't clock out");
    expect(dialogText()).toContain("closed automatically");
  });

  it("stays out of the way when there is nothing to correct", () => {
    mocks.pending = null;
    render();
    expect(container.innerHTML).toBe("");
  });

  it("starts with the time the system used, so the employee only edits it if it was different", () => {
    const pending = autoClosed();
    mocks.pending = pending;
    render();
    const input = container.querySelector<HTMLInputElement>("#correction-time")!;
    expect(new Date(input.value).getTime()).toBe(Math.floor(new Date(pending.clockOutAt!).getTime() / 60_000) * 60_000);
  });

  it("needs a note before it can be submitted", () => {
    mocks.pending = autoClosed();
    render();
    expect(submitButton().disabled).toBe(true);
    type("ab");
    expect(submitButton().disabled).toBe(true);
    type("Forgot to clock out");
    expect(submitButton().disabled).toBe(false);
  });

  it("submits the session id, the chosen time as an ISO instant, and the trimmed note", () => {
    const pending = autoClosed();
    mocks.pending = pending;
    render();
    const chosen = new Date(new Date(pending.clockInAt).getTime() + 9 * 60 * MIN); // 9h after clock-in
    setInput("#correction-time", toLocalInputForTest(chosen));
    type("  Left at the usual time  ");
    act(() => submitButton().click());

    expect(mocks.correctionMutate).toHaveBeenCalledTimes(1);
    const arg = mocks.correctionMutate.mock.calls[0][0];
    expect(arg.sessionId).toBe("old1");
    expect(arg.note).toBe("Left at the usual time");
    expect(arg.clockOutAt).toBe(new Date(Math.floor(chosen.getTime() / 60_000) * 60_000).toISOString());
  });

  it("refuses a time before they clocked in", () => {
    const pending = autoClosed();
    mocks.pending = pending;
    render();
    setInput("#correction-time", toLocalInputForTest(new Date(new Date(pending.clockInAt).getTime() - 60 * MIN)));
    type("Forgot to clock out");
    expect(submitButton().disabled).toBe(true);
    expect(dialogText()).toContain("Pick a time between");
  });

  it("refuses a time more than 14 hours after clocking in", () => {
    const pending = autoClosed();
    mocks.pending = pending;
    render();
    setInput("#correction-time", toLocalInputForTest(new Date(new Date(pending.clockInAt).getTime() + 14 * 60 * MIN + 5 * MIN)));
    type("Forgot to clock out");
    expect(submitButton().disabled).toBe(true);
  });

  it("'Later' hides it for now without submitting anything", () => {
    mocks.pending = autoClosed();
    render();
    act(() => buttonByText("Later").click());
    expect(container.innerHTML).toBe("");
    expect(mocks.correctionMutate).not.toHaveBeenCalled();
  });

  it("fills the note from a quick chip", () => {
    mocks.pending = autoClosed();
    render();
    act(() => buttonByText("Power / internet issue").click());
    expect(container.querySelector("textarea")!.value).toBe("Power / internet issue");
  });

  it("is the least urgent prompt: a late-arrival question comes first", () => {
    mocks.session = makeSession({ lateByMin: 30 });
    mocks.pending = autoClosed();
    render();
    expect(dialogText()).toContain("You clocked in late");
    expect(dialogText()).not.toContain("You didn't clock out");
  });
});

// Mirrors the component's own helper without importing it (it lives next to the component).
function toLocalInputForTest(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
