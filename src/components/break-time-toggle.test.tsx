import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  session: null as unknown,
  startMutate: vi.fn(),
  endMutate: vi.fn(),
}));

vi.mock("@/hooks/use-work-session", () => ({
  ACTIVE_SESSION_KEY: ["work-sessions", "active"],
  useActiveWorkSession: () => ({ data: mocks.session, isLoading: false }),
  useStartBreak: () => ({ mutate: mocks.startMutate, isPending: false }),
  useEndBreak: () => ({ mutate: mocks.endMutate, isPending: false }),
}));

import { TopBarBreakButton } from "./break-time-toggle";

let container: HTMLDivElement;
let root: Root;

function render() {
  const qc = new QueryClient();
  act(() =>
    root.render(
      <QueryClientProvider client={qc}>
        <TopBarBreakButton />
      </QueryClientProvider>,
    ),
  );
}

const session = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  isOnBreak: false,
  breakRemainingSeconds: 0,
  cooldownRemainingSeconds: 0,
  ...over,
});
const text = () => document.body.textContent ?? "";
const buttonByText = (t: string) =>
  Array.from(document.body.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent?.includes(t))!;

beforeEach(() => {
  mocks.session = null;
  mocks.startMutate.mockReset();
  mocks.endMutate.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("TopBarBreakButton", () => {
  it("is disabled until the person clocks in", () => {
    render();
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector('[aria-label="Clock in to take a break."]')).not.toBeNull();
  });

  it("starts a break after confirming", () => {
    mocks.session = session();
    render();
    act(() => buttonByText("Break").click());
    expect(text()).toContain("Start 1-Hour Break?");
    act(() => buttonByText("Start Break (60m)").click());
    expect(mocks.startMutate).toHaveBeenCalledTimes(1);
  });

  it("shows the time left on a break and resumes work on request", () => {
    mocks.session = session({ isOnBreak: true, breakRemainingSeconds: 42 * 60 + 10 });
    render();
    expect(text()).toContain("42:10");
    act(() => buttonByText("Resume").click());
    act(() => buttonByText("End Break & Resume Work").click());
    expect(mocks.endMutate).toHaveBeenCalledTimes(1);
  });

  it("is locked during the 5-hour cooldown", () => {
    mocks.session = session({ cooldownRemainingSeconds: 3 * 3600 + 20 * 60 });
    render();
    expect(container.querySelector("button")).toBeNull();
    expect(text()).toContain("Break in 3h 20m");
  });
});
