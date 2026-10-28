import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  connected: true,
  searchAsync: vi.fn(),
  enrichAsync: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/hooks/use-apollo", () => ({
  useApolloConnection: () => ({ data: { connected: mocks.connected } }),
}));
vi.mock("@/hooks/use-sequences", () => ({ useSequences: () => ({ data: [{ id: "s1", name: "Warm intro" }] }) }));
vi.mock("@/hooks/use-hiring-signals", () => ({
  useSearchIntentNews: () => ({ mutateAsync: mocks.searchAsync, isPending: false }),
  useEnrichIntentCompanies: () => ({ mutateAsync: mocks.enrichAsync, isPending: false }),
  useResolveAndSendIntentLead: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/components/intent-email-automate-dialog", () => ({
  IntentEmailAutomateDialog: ({ open, defaultSelectedLeadIds }: { open: boolean; defaultSelectedLeadIds?: string[] }) =>
    open ? <div data-testid="automate">{(defaultSelectedLeadIds ?? []).join(",")}</div> : null,
}));

import { IntentNewsPanel } from "./intent-news-panel";

const lead = (id: string, company: string, withDm: boolean) => ({
  id,
  jobTitle: `${company} raises Series A`,
  jobUrl: `https://news.example/${id}`,
  companyName: company,
  companyDomain: `${company.toLowerCase()}.com`,
  discoveredAt: "2026-10-01T00:00:00.000Z",
  source: "APOLLO_NEWS" as const,
  newsCategory: "FUNDING" as const,
  newsCategoryLabel: "Funding",
  decisionMaker: withDm
    ? { name: "Ann Lee", title: "CEO", email: "ann@acme.com", linkedinUrl: null }
    : null,
});

describe("IntentNewsPanel", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.connected = true;
    mocks.searchAsync.mockReset();
    mocks.enrichAsync.mockReset();
    localStorage.clear();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  function type(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => {
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  async function submit() {
    await act(async () => {
      host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
  }

  it("searches with the typed topic and lists companies, headlines and decision makers", async () => {
    mocks.searchAsync.mockResolvedValue({ leads: [lead("n1", "Acme", true), lead("n2", "Globex", false)] });
    act(() => root.render(<IntentNewsPanel />));

    type(host.querySelector("#news-keywords") as HTMLInputElement, "fintech");
    await submit();

    expect(mocks.searchAsync).toHaveBeenCalledWith(
      expect.objectContaining({ keywords: "fintech", category: undefined, daysBack: 30 }),
    );
    expect(host.textContent).toContain("Acme raises Series A");
    expect(host.textContent).toContain("Ann Lee");
    expect(host.textContent).toContain("ann@acme.com");
    expect(host.textContent).toContain("Find contact"); // Globex has no decision maker yet
    expect(host.textContent).toContain("2 companies");
  });

  it("disables searching until Apollo is connected", () => {
    mocks.connected = false;
    act(() => root.render(<IntentNewsPanel />));
    expect(host.textContent).toContain("Apollo isn't connected");
    expect((host.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it("opens outreach for just the clicked row", async () => {
    mocks.searchAsync.mockResolvedValue({ leads: [lead("n1", "Acme", true), lead("n2", "Globex", false)] });
    act(() => root.render(<IntentNewsPanel />));
    type(host.querySelector("#news-keywords") as HTMLInputElement, "saas");
    await submit();

    const outreach = Array.from(host.querySelectorAll("button")).filter((b) => b.textContent === "Outreach");
    act(() => outreach[1].click());
    expect(document.body.querySelector('[data-testid="automate"]')?.textContent).toBe("n2");
  });

  it("shows an empty state instead of fake results when nothing matches", async () => {
    mocks.searchAsync.mockResolvedValue({ leads: [] });
    act(() => root.render(<IntentNewsPanel />));
    type(host.querySelector("#news-keywords") as HTMLInputElement, "quantum");
    await submit();
    expect(host.textContent).toContain("No companies with matching news");
  });

  it("starts with blank fields upon reload and clears search on reset", async () => {
    mocks.searchAsync.mockResolvedValue({ leads: [lead("n1", "Acme", true)] });
    act(() => root.render(<IntentNewsPanel />));
    type(host.querySelector("#news-keywords") as HTMLInputElement, "fintech");
    await submit();
    act(() => root.unmount());

    root = createRoot(host);
    act(() => root.render(<IntentNewsPanel />));
    expect((host.querySelector("#news-keywords") as HTMLInputElement).value).toBe("");
    expect((host.querySelector("#news-location") as HTMLInputElement).value).toBe("");
    expect(host.textContent).not.toContain("Acme raises Series A");
  });
});
