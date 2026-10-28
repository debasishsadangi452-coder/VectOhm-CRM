import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IntentAutomation, IntentOutreach } from "@/lib/api/intent-automations";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  automations: [] as unknown[],
  pending: [] as unknown[],
  leads: [] as unknown[],
  leadsArgs: undefined as unknown,
  approve: vi.fn(),
  reject: vi.fn(),
  update: vi.fn(),
  runNow: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/hooks/use-intent-automations", () => {
  const idle = { mutateAsync: vi.fn(), isPending: false };
  return {
    useIntentAutomations: () => ({ data: mocks.automations, isLoading: false }),
    useIntentOutreach: (p: { status?: string } = {}) => ({ data: p.status === "PENDING_APPROVAL" ? mocks.pending : [] }),
    useIntentAutomationRuns: () => ({ data: [{ id: "r1", trigger: "SCHEDULE", status: "COMPLETED", startedAt: "2026-10-10T03:30:00.000Z", leadsFound: 3, sent: 0, queued: 1, skipped: 2, failed: 0, error: null }], isLoading: false }),
    useIntentAutomationLeads: (_id: string, args: unknown) => {
      mocks.leadsArgs = args;
      return { data: mocks.leads, isLoading: false };
    },
    useCreateIntentAutomation: () => idle,
    useUpdateIntentAutomation: () => ({ mutateAsync: mocks.update, isPending: false }),
    useDeleteIntentAutomation: () => idle,
    useRunIntentAutomation: () => ({ mutateAsync: mocks.runNow, isPending: false }),
    useApproveOutreach: () => ({ mutateAsync: mocks.approve, isPending: false }),
    useRejectOutreach: () => ({ mutateAsync: mocks.reject, isPending: false }),
    useApproveAllOutreach: () => idle,
    useUpdateOutreachDraft: () => idle,
  };
});

import { IntentAutomationsPanel, formToInput, scheduleLabel } from "./intent-automations-panel";

const automation = (over: Partial<IntentAutomation> = {}): IntentAutomation => ({
  id: "a1",
  name: "India devs",
  isActive: true,
  source: "BOTH",
  roles: ["Developer"],
  location: "India",
  newsKeywords: "fintech",
  newsCategory: null,
  newsDaysBack: 30,
  frequency: "DAILY",
  timeOfDay: "09:00",
  weekday: null,
  autoSend: false,
  dailyCap: 25,
  cooldownDays: 30,
  offerDescription: "We place developers.",
  tone: "friendly",
  nextRunAt: "2026-10-11T03:30:00.000Z",
  lastRunAt: null,
  createdBy: { id: "u1", firstName: "Sam", lastName: "T" },
  lastRun: null,
  pendingApproval: 1,
  ...over,
});

const outreach = (): IntentOutreach => ({
  id: "o1",
  automationId: "a1",
  automation: { id: "a1", name: "India devs", autoSend: false },
  companyName: "Acme",
  contactName: "Ann Lee",
  contactTitle: "CEO",
  contactEmail: "ann@acme.com",
  signalType: "HIRING",
  signalTitle: "Acme Developer",
  signalUrl: null,
  subject: "Quick idea for Acme",
  body: "Hi Ann, ...",
  status: "PENDING_APPROVAL",
  error: null,
  sentAt: null,
  createdAt: "2026-10-10T00:00:00.000Z",
});

describe("scheduleLabel / formToInput", () => {
  it("describes each frequency", () => {
    expect(scheduleLabel({ frequency: "DAILY", timeOfDay: "09:00", weekday: null })).toBe("Every day at 09:00");
    expect(scheduleLabel({ frequency: "WEEKDAYS", timeOfDay: "08:30", weekday: null })).toBe("Weekdays at 08:30");
    expect(scheduleLabel({ frequency: "WEEKLY", timeOfDay: "10:00", weekday: 3 })).toBe("Every Wednesday at 10:00");
  });

  it("builds the API payload: only sends fields that apply to the source", () => {
    const base = {
      name: " Devs ", source: "HIRING" as const, roles: "Dev, , DevOps ", location: " India ", newsKeywords: "ignored",
      newsCategory: "FUNDING" as const, newsDaysBack: "30", frequency: "WEEKLY" as const, timeOfDay: "09:00", weekday: "3",
      autoSend: false, dailyCap: "25", cooldownDays: "30", offerDescription: " We place devs. ", tone: "",
    };
    expect(formToInput(base)).toMatchObject({
      name: "Devs", roles: ["Dev", "DevOps"], location: "India", newsKeywords: undefined, newsCategory: undefined,
      weekday: 3, dailyCap: 25, offerDescription: "We place devs.", tone: undefined,
    });
    expect(formToInput({ ...base, source: "NEWS", frequency: "DAILY" })).toMatchObject({
      roles: [], newsKeywords: "ignored", newsCategory: "FUNDING", weekday: undefined,
    });
  });
});

describe("IntentAutomationsPanel", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.automations = [];
    mocks.pending = [];
    Object.values(mocks).forEach((m) => typeof m === "function" && "mockReset" in m && (m as ReturnType<typeof vi.fn>).mockReset());
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const button = (text: string) =>
    Array.from(document.body.querySelectorAll("button")).find((b) => b.textContent?.trim().includes(text)) as HTMLButtonElement;

  it("shows an empty state", () => {
    act(() => root.render(<IntentAutomationsPanel />));
    expect(host.textContent).toContain("No automations yet");
  });

  it("lists automations with schedule, approval mode and the waiting count", () => {
    mocks.automations = [automation()];
    mocks.pending = [outreach()];
    act(() => root.render(<IntentAutomationsPanel />));
    expect(host.textContent).toContain("India devs");
    expect(host.textContent).toContain("Every day at 09:00");
    expect(host.textContent).toContain("Needs approval");
    expect(host.textContent).toContain("1 waiting");
  });

  it("shows pending drafts and approves one", async () => {
    mocks.automations = [automation()];
    mocks.pending = [outreach()];
    mocks.approve.mockResolvedValue({ status: "SENT" });
    act(() => root.render(<IntentAutomationsPanel />));
    expect(host.textContent).toContain("Waiting for your approval (1)");
    expect(host.textContent).toContain("Quick idea for Acme");
    await act(async () => button("Approve & send").click());
    expect(mocks.approve).toHaveBeenCalledWith("o1");
  });

  it("pauses an automation through the switch", async () => {
    mocks.automations = [automation()];
    mocks.update.mockResolvedValue({});
    act(() => root.render(<IntentAutomationsPanel />));
    const toggle = host.querySelector('[role="switch"][aria-label="India devs active"]') as HTMLButtonElement;
    await act(async () => toggle.click());
    expect(mocks.update).toHaveBeenCalledWith({ id: "a1", input: { isActive: false } });
  });

  it("runs an automation on demand", async () => {
    mocks.automations = [automation()];
    mocks.runNow.mockResolvedValue({ status: "COMPLETED", leadsFound: 5, sent: 0, queued: 3, skipped: 2 });
    act(() => root.render(<IntentAutomationsPanel />));
    await act(async () => button("Run now").click());
    expect(mocks.runNow).toHaveBeenCalledWith("a1");
  });

  it("shows the saved leads of an automation, including skipped ones and why", () => {
    mocks.automations = [automation()];
    mocks.leads = [
      { id: "l1", companyName: "Acme", companyDomain: "acme.com", companyLocation: null, signalType: "HIRING", signalTitle: "Acme Developer", signalUrl: "https://x/job", signalDetail: null, signalDate: null, contactName: "Ann Lee", contactTitle: "CEO", contactEmail: "ann@acme.com", contactLinkedin: null, outcome: "QUEUED", skipReason: null, createdAt: "2026-10-10T03:30:00.000Z" },
      { id: "l2", companyName: "Globex", companyDomain: null, companyLocation: "India", signalType: "NEWS", signalTitle: "Globex raises Series A", signalUrl: null, signalDetail: null, signalDate: null, contactName: null, contactTitle: null, contactEmail: null, contactLinkedin: null, outcome: "SKIPPED", skipReason: "NO_EMAIL", createdAt: "2026-10-10T03:30:00.000Z" },
    ];
    act(() => root.render(<IntentAutomationsPanel />));
    act(() => (host.querySelector('button[aria-expanded="false"]') as HTMLButtonElement).click());
    expect(host.textContent).toContain("Saved leads");
    expect(host.textContent).toContain("ann@acme.com");
    expect(host.textContent).toContain("Globex raises Series A");
    expect(host.textContent).toContain("No email found");
    expect(host.textContent).toContain("none found");
    expect(mocks.leadsArgs).toEqual({ runId: undefined, outcome: undefined });
  });

  it("clicking a run limits the leads to that run", () => {
    mocks.automations = [automation()];
    act(() => root.render(<IntentAutomationsPanel />));
    act(() => (host.querySelector('button[aria-expanded="false"]') as HTMLButtonElement).click());
    act(() => (host.querySelector("button[title=\"Show only this run's leads\"]") as HTMLButtonElement).click());
    expect(mocks.leadsArgs).toEqual({ runId: "r1", outcome: undefined });
  });
});
