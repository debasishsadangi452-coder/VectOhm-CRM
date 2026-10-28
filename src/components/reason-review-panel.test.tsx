import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  state: { isPending: false, isError: false, error: null as unknown },
}));

vi.mock("@/hooks/use-work-session", () => ({
  useReviewReason: () => ({ mutate: mocks.mutate, ...mocks.state }),
}));

import { ReasonReviewPanel, ReviewBadge } from "./reason-review-panel";

let container: HTMLDivElement;
let root: Root;
const text = () => container.textContent ?? "";
const buttonByText = (t: string) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent?.trim() === t);

type Props = Partial<React.ComponentProps<typeof ReasonReviewPanel>>;
const render = (props: Props = {}) =>
  act(() =>
    root.render(
      <ReasonReviewPanel sessionId="s1" kind="LATE" canReview hasReason {...props} />,
    ),
  );

function type(value: string) {
  const textarea = container.querySelector("textarea")!;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  act(() => {
    setter.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(() => {
  mocks.mutate.mockReset();
  mocks.state = { isPending: false, isError: false, error: null };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("ReviewBadge", () => {
  it("labels the decision in plain words", () => {
    act(() => root.render(<ReviewBadge status="EXCUSED" />));
    expect(text()).toBe("Excused");
    act(() => root.render(<ReviewBadge status="REJECTED" />));
    expect(text()).toBe("Not accepted");
  });
  it("renders nothing when there is no decision", () => {
    act(() => root.render(<ReviewBadge status={null} />));
    expect(container.innerHTML).toBe("");
  });
});

describe("ReasonReviewPanel — deciding", () => {
  it("offers Excuse and Not accepted to someone who can review", () => {
    render();
    expect(buttonByText("Excuse")).toBeDefined();
    expect(buttonByText("Not accepted")).toBeDefined();
  });

  it("Excuse sends the decision for this session and kind straight away", () => {
    render({ sessionId: "abc", kind: "EARLY" });
    act(() => buttonByText("Excuse")!.click());
    expect(mocks.mutate.mock.calls[0][0]).toEqual({ sessionId: "abc", kind: "EARLY", status: "EXCUSED", note: undefined });
  });

  it("Not accepted asks for a note first, and won't send without a real one", () => {
    render();
    act(() => buttonByText("Not accepted")!.click());
    expect(mocks.mutate).not.toHaveBeenCalled(); // opened the note box, nothing sent yet

    const send = () => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent?.includes("Not accepted") && b.className.includes("bg-red"))!;
    expect(send().disabled).toBe(true);
    type("ab");
    expect(send().disabled).toBe(true);
    type("  Not agreed in advance  ");
    expect(send().disabled).toBe(false);

    act(() => send().click());
    expect(mocks.mutate.mock.calls[0][0]).toEqual({ sessionId: "s1", kind: "LATE", status: "REJECTED", note: "Not agreed in advance" });
  });

  it("Cancel closes the note box without sending", () => {
    render();
    act(() => buttonByText("Not accepted")!.click());
    act(() => buttonByText("Cancel")!.click());
    expect(container.querySelector("textarea")).toBeNull();
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("tells the reviewer when no reason was given yet, but still lets them decide", () => {
    render({ hasReason: false });
    expect(text()).toContain("No reason given yet");
    expect(buttonByText("Excuse")).toBeDefined();
  });

  it("shows the server's error if saving fails", () => {
    mocks.state = { isPending: false, isError: true, error: new Error("You can't review this person's reasons.") };
    render();
    expect(text()).toContain("You can't review this person's reasons.");
  });
});

describe("ReasonReviewPanel — after a decision", () => {
  it("shows the decision and its note", () => {
    render({ status: "REJECTED", note: "Not a valid reason" });
    expect(text()).toContain("Not accepted");
    expect(text()).toContain("Not a valid reason");
    expect(buttonByText("Excuse")).toBeUndefined(); // already decided
  });

  it("a reviewer can change the decision, which clears it", () => {
    render({ status: "EXCUSED" });
    act(() => buttonByText("Change decision")!.click());
    expect(mocks.mutate.mock.calls[0][0]).toMatchObject({ sessionId: "s1", kind: "LATE", status: "PENDING" });
  });

  it("someone who can't review sees the decision but no controls", () => {
    render({ canReview: false, status: "EXCUSED" });
    expect(text()).toContain("Excused");
    expect(buttonByText("Change decision")).toBeUndefined();
    expect(buttonByText("Excuse")).toBeUndefined();
  });

  it("someone who can't review sees nothing at all while it is undecided", () => {
    render({ canReview: false, status: null });
    expect(container.innerHTML).toBe("");
  });
});
