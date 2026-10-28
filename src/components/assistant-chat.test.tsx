import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistantCapabilities, AssistantConversation } from "@/lib/api/assistant";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  caps: undefined as unknown,
  list: [] as unknown[],
  conversation: undefined as unknown,
  activeIdArg: undefined as unknown,
  send: vi.fn(),
  confirm: vi.fn(),
  cancel: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/hooks/use-assistant", () => ({
  useAssistantCapabilities: () => ({ data: mocks.caps }),
  useAssistantConversations: () => ({ data: mocks.list }),
  useAssistantConversation: (id: string | null) => {
    mocks.activeIdArg = id;
    return { data: id ? mocks.conversation : undefined, isLoading: false };
  },
  useSendAssistantMessage: () => ({ mutateAsync: mocks.send, isPending: false }),
  useConfirmAssistantAction: () => ({ mutateAsync: mocks.confirm, isPending: false }),
  useCancelAssistantAction: () => ({ mutateAsync: mocks.cancel, isPending: false }),
  useDeleteAssistantConversation: () => ({ mutateAsync: mocks.remove, isPending: false }),
}));

import { AssistantChat } from "./assistant-chat";

const caps = (over: Partial<AssistantCapabilities> = {}): AssistantCapabilities => ({
  configured: true,
  tools: [{ name: "list_tasks", write: false }, { name: "create_task", write: true }],
  suggestions: ["What tasks are overdue for me?"],
  ...over,
});

const conversation = (over: Partial<AssistantConversation> = {}): AssistantConversation => ({
  id: "c1",
  title: "My tasks",
  messages: [
    { id: "m1", role: "user", text: "my tasks?", tools: [], createdAt: "2026-10-10T00:00:00Z" },
    { id: "m2", role: "assistant", text: "You have 1 task.", tools: ["list_tasks"], createdAt: "2026-10-10T00:00:01Z" },
  ],
  actions: [],
  ...over,
});

describe("AssistantChat", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.caps = caps();
    mocks.list = [{ id: "c1", title: "My tasks", updatedAt: "2026-10-10T00:00:00Z" }];
    mocks.conversation = conversation();
    [mocks.send, mocks.confirm, mocks.cancel, mocks.remove].forEach((m) => m.mockReset());
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const button = (text: string) =>
    Array.from(host.querySelectorAll("button")).find((b) => b.textContent?.trim().includes(text)) as HTMLButtonElement;
  const type = (value: string) => {
    const box = host.querySelector("textarea") as HTMLTextAreaElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    act(() => {
      setter.call(box, value);
      box.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };

  it("starts with role-based suggestions that send when clicked", async () => {
    mocks.send.mockResolvedValue(conversation());
    act(() => root.render(<AssistantChat />));
    expect(host.textContent).toContain("How can I help?");
    expect(host.textContent).toContain("2 abilities for your role");
    expect(host.textContent).toContain("asks before changing anything");
    await act(async () => button("What tasks are overdue for me?").click());
    expect(mocks.send).toHaveBeenCalledWith({ conversationId: undefined, message: "What tasks are overdue for me?" });
  });

  it("sends the typed message with Enter and continues the open conversation", async () => {
    mocks.send.mockResolvedValue(conversation());
    act(() => root.render(<AssistantChat />));
    act(() => button("My tasks").click()); // open the past chat
    type("and my bugs?");
    const box = host.querySelector("textarea") as HTMLTextAreaElement;
    await act(async () => {
      box.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(mocks.send).toHaveBeenCalledWith({ conversationId: "c1", message: "and my bugs?" });
  });

  it("shows the conversation, including which tools the assistant used", () => {
    act(() => root.render(<AssistantChat />));
    act(() => button("My tasks").click());
    expect(host.textContent).toContain("You have 1 task.");
    expect(host.textContent).toContain("Checked tasks");
  });

  it("shows a confirm card for a pending action and confirms it", async () => {
    mocks.conversation = conversation({
      actions: [{ id: "a1", toolName: "create_task", summary: 'Create task "Call Acme".', status: "PENDING", error: null, createdAt: "" }],
    });
    mocks.confirm.mockResolvedValue(conversation());
    act(() => root.render(<AssistantChat />));
    act(() => button("My tasks").click());
    expect(host.textContent).toContain("Needs your confirmation");
    expect(host.textContent).toContain('Create task "Call Acme".');
    await act(async () => button("Confirm").click());
    expect(mocks.confirm).toHaveBeenCalledWith("a1");
  });

  it("cancels a pending action without confirming it", async () => {
    mocks.conversation = conversation({
      actions: [{ id: "a1", toolName: "create_task", summary: "Create a task.", status: "PENDING", error: null, createdAt: "" }],
    });
    mocks.cancel.mockResolvedValue(conversation());
    act(() => root.render(<AssistantChat />));
    act(() => button("My tasks").click());
    await act(async () => button("Cancel").click());
    expect(mocks.cancel).toHaveBeenCalledWith("a1");
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it("does not show cards for actions that are already settled", () => {
    mocks.conversation = conversation({
      actions: [{ id: "a1", toolName: "create_task", summary: "Create a task.", status: "CONFIRMED", error: null, createdAt: "" }],
    });
    act(() => root.render(<AssistantChat />));
    act(() => button("My tasks").click());
    expect(host.textContent).not.toContain("Needs your confirmation");
  });

  it("warns and blocks sending when the server has no AI key", () => {
    mocks.caps = caps({ configured: false });
    act(() => root.render(<AssistantChat />));
    expect(host.textContent).toContain("isn't set up on this server yet");
    type("hello");
    expect((host.querySelector('button[aria-label="Send"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it("does not send an empty message", async () => {
    act(() => root.render(<AssistantChat />));
    type("   ");
    expect((host.querySelector('button[aria-label="Send"]') as HTMLButtonElement).disabled).toBe(true);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("puts the message back in the box when sending fails", async () => {
    mocks.send.mockRejectedValue(new Error("hourly limit"));
    act(() => root.render(<AssistantChat />));
    type("hello");
    await act(async () => (host.querySelector("form") as HTMLFormElement).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect((host.querySelector("textarea") as HTMLTextAreaElement).value).toBe("hello");
  });
});
