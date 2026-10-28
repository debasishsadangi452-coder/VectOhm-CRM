import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { IntentOutreachStatus, RoleName } from "@prisma/client";
import { computeNextRun, startOfCompanyDay } from "./intent-automation.schedule";
import { parseDraft, buildPrompt } from "./intent-automation-ai.service";
import { IntentAutomationService } from "./intent-automation.service";
import type { RequestUser } from "../../common/types/request-user.type";

// IST = UTC+05:30. 09:00 IST == 03:30 UTC.
const utc = (s: string) => new Date(s);

describe("computeNextRun", () => {
  it("daily: later today if the time hasn't passed, otherwise tomorrow", () => {
    const cfg = { frequency: "DAILY" as const, timeOfDay: "09:00" };
    expect(computeNextRun(utc("2026-10-10T02:00:00Z"), cfg).toISOString()).toBe("2026-10-10T03:30:00.000Z");
    expect(computeNextRun(utc("2026-10-10T03:30:00Z"), cfg).toISOString()).toBe("2026-10-11T03:30:00.000Z");
  });

  it("uses the company-time day, not the UTC day (23:00 UTC is already 04:30 tomorrow in IST)", () => {
    const cfg = { frequency: "DAILY" as const, timeOfDay: "09:00" };
    expect(computeNextRun(utc("2026-10-10T23:00:00Z"), cfg).toISOString()).toBe("2026-10-11T03:30:00.000Z");
    // 20:00 UTC on the 10th is 01:30 IST on the 11th -> 09:00 IST that same IST day.
    expect(computeNextRun(utc("2026-10-10T20:00:00Z"), cfg).toISOString()).toBe("2026-10-11T03:30:00.000Z");
  });

  it("weekdays skips Saturday and Sunday", () => {
    const cfg = { frequency: "WEEKDAYS" as const, timeOfDay: "09:00" };
    // Fri 9 Oct 2026 12:00 UTC -> next is Monday 12 Oct
    expect(computeNextRun(utc("2026-10-09T12:00:00Z"), cfg).toISOString()).toBe("2026-10-12T03:30:00.000Z");
  });

  it("weekly lands on the chosen weekday (default Monday)", () => {
    // 10 Oct 2026 is a Saturday. Wednesday = 3.
    expect(
      computeNextRun(utc("2026-10-10T00:00:00Z"), { frequency: "WEEKLY", timeOfDay: "10:15", weekday: 3 }).toISOString(),
    ).toBe("2026-10-14T04:45:00.000Z");
    expect(computeNextRun(utc("2026-10-10T00:00:00Z"), { frequency: "WEEKLY", timeOfDay: "09:00" }).toISOString()).toBe(
      "2026-10-12T03:30:00.000Z",
    );
  });

  it("startOfCompanyDay is midnight IST", () => {
    expect(startOfCompanyDay(utc("2026-10-10T20:00:00Z")).toISOString()).toBe("2026-10-10T18:30:00.000Z");
  });
});

describe("AI draft guard", () => {
  it("accepts a clean JSON draft", () => {
    expect(parseDraft('Sure {"subject":"Hello","body":"Hi Ann,\\nQuick note."}')).toEqual({
      subject: "Hello",
      body: "Hi Ann,\nQuick note.",
    });
  });
  it.each([
    "not json",
    '{"subject":"","body":"x"}',
    '{"subject":"Hi [Name]","body":"Body"}',
    '{"subject":"Hi","body":"Dear {{firstName}}"}',
  ])("rejects unusable output: %s", (text) => {
    expect(parseDraft(text)).toBeNull();
  });
  it("the prompt only uses facts we pass in and forbids invention", () => {
    const prompt = buildPrompt({
      senderFirstName: "Sam",
      senderCompany: "Venus",
      offerDescription: "Developer staffing",
      tone: "friendly",
      contactFirstName: "Ann",
      contactTitle: "CEO",
      companyName: "Acme",
      signalType: "NEWS",
      signalTitle: "Acme raises Series A",
      signalDetail: null,
    });
    expect(prompt).toContain("Acme raises Series A");
    expect(prompt).toContain("Developer staffing");
    expect(prompt).toMatch(/do not invent/i);
  });
});

const user = (id: string, role: RoleName = RoleName.EMPLOYEE, dept = "Recruitment"): RequestUser =>
  ({ id, email: "u@x.com", firstName: "Sam", lastName: "T", role: { id: "r", name: role }, department: { id: "d", name: dept, managerTitle: "L" } }) as RequestUser;

const automation = (over: Record<string, unknown> = {}) => ({
  id: "a1",
  name: "Daily devs",
  isActive: true,
  source: "HIRING",
  roles: ["Developer"],
  location: "India",
  newsKeywords: null,
  newsCategory: null,
  newsDaysBack: 30,
  frequency: "DAILY",
  timeOfDay: "09:00",
  weekday: null,
  autoSend: false,
  dailyCap: 2,
  cooldownDays: 30,
  offerDescription: "We place developers at growing companies.",
  tone: "friendly",
  nextRunAt: null,
  lastRunAt: null,
  createdById: "owner",
  ...over,
});

const lead = (id: string, company: string, email: string | null) => ({
  id,
  jobTitle: `${company} Developer`,
  jobUrl: "https://x/job",
  companyName: company,
  companyDomain: `${company.toLowerCase()}.com`,
  companyLocation: "India",
  decisionMaker: email ? { name: "Ann Lee", firstName: "Ann", lastName: "Lee", title: "CEO", email, linkedinUrl: null } : null,
});

describe("IntentAutomationService.runAutomation", () => {
  let prisma: any;
  let discovery: any;
  let ai: any;
  let suppression: any;
  let emailConnections: any;
  let notifications: any;
  let service: IntentAutomationService;
  let sendMail: jest.Mock;

  beforeEach(() => {
    sendMail = jest.fn().mockResolvedValue({});
    prisma = {
      intentAutomation: { findUnique: jest.fn().mockResolvedValue(automation()), update: jest.fn(), updateMany: jest.fn(), findMany: jest.fn() },
      intentAutomationRun: { create: jest.fn().mockResolvedValue({ id: "run1" }), update: jest.fn().mockImplementation(async ({ data }: any) => ({ ...data })) },
      intentAutomationOutreach: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: `o-${data.contactEmail}`, ...data })),
        findUniqueOrThrow: jest.fn().mockImplementation(async ({ where }: any) => ({
          id: where.id,
          contactEmail: where.id.replace("o-", ""),
          contactName: "Ann Lee",
          contactTitle: "CEO",
          companyName: "Acme",
          companyDomain: null,
          subject: "Hi",
          body: "Hello",
          automation: { createdById: "owner" },
        })),
        update: jest.fn().mockImplementation(async ({ data }: any) => ({ ...data })),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      bulkEmailRecipient: { findFirst: jest.fn().mockResolvedValue(null) },
      intentAutomationLead: { createMany: jest.fn().mockResolvedValue({ count: 0 }), findMany: jest.fn().mockResolvedValue([]) },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: "owner", isActive: true, firstName: "Sam", lastName: "T", email: "sam@x.com", role: { id: "r", name: "EMPLOYEE" }, department: { id: "d", name: "Recruitment", managerTitle: "L" } }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ emailSignatureHtml: null }),
      },
      contact: { findFirst: jest.fn().mockResolvedValue({ id: "c1" }), create: jest.fn().mockResolvedValue({ id: "new" }) },
      company: { findFirst: jest.fn().mockResolvedValue({ id: "co1" }), create: jest.fn().mockResolvedValue({ id: "co-new" }) },
    };
    discovery = {
      searchIntentHiring: jest.fn().mockResolvedValue({
        leads: [lead("lead-1", "Acme", "ann@acme.com"), lead("lead-sample-2", "Datadog", "x@datadog.com"), lead("lead-3", "Globex", null), lead("lead-4", "Initech", "bob@initech.com"), lead("lead-5", "Hooli", "cat@hooli.com")],
      }),
      searchIntentNews: jest.fn().mockResolvedValue({ leads: [] }),
    };
    ai = { isConfigured: jest.fn().mockReturnValue(true), generateDraft: jest.fn().mockResolvedValue({ subject: "Hi", body: "Hello" }) };
    suppression = { isSuppressed: jest.fn().mockResolvedValue(false) };
    emailConnections = { requireSendable: jest.fn().mockResolvedValue({ mode: "smtp", transporter: { sendMail }, from: "sam@x.com" }) };
    notifications = { create: jest.fn() };
    service = new IntentAutomationService(prisma, discovery, ai, suppression, emailConnections, {} as any, notifications, { get: jest.fn() } as any);
  });

  it("queues drafts for approval (autoSend off), skips sample/no-email leads, honours the daily cap", async () => {
    const run: any = await service.runAutomation("a1", "MANUAL");
    expect(discovery.searchIntentHiring).toHaveBeenCalledWith(expect.anything(), expect.anything(), { persist: false, allowSamples: false });
    expect(ai.generateDraft).toHaveBeenCalledTimes(2); // cap = 2
    expect(run).toMatchObject({ queued: 2, sent: 0, status: "COMPLETED" });
    expect(sendMail).not.toHaveBeenCalled();
    const created = prisma.intentAutomationOutreach.create.mock.calls.map((c: any) => c[0].data.contactEmail);
    expect(created).toEqual(["ann@acme.com", "bob@initech.com"]); // sample + no-email never drafted
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: "owner", link: "/intent-hiring?tab=automations" }));
  });

  const savedLeads = () => prisma.intentAutomationLead.createMany.mock.calls.flatMap((c: any) => c[0].data);

  it("saves every lead the run found, with its outcome and why it was skipped", async () => {
    await service.runAutomation("a1", "MANUAL");
    const leads = savedLeads();
    expect(leads).toHaveLength(4); // 5 found minus the sample row the discovery step already drops
    const by = (company: string) => leads.find((l: any) => l.companyName === company);
    expect(by("Acme")).toMatchObject({ outcome: "QUEUED", outreachId: "o-ann@acme.com", contactEmail: "ann@acme.com", signalType: "HIRING", runId: "run1", automationId: "a1" });
    expect(by("Globex")).toMatchObject({ outcome: "SKIPPED", skipReason: "NO_EMAIL", contactEmail: null });
    expect(by("Initech")).toMatchObject({ outcome: "QUEUED" });
    expect(by("Hooli")).toMatchObject({ outcome: "SKIPPED", skipReason: "DAILY_CAP_REACHED" }); // cap is 2
  });

  it("records the reason when a lead is suppressed or recently contacted", async () => {
    suppression.isSuppressed.mockImplementation(async (e: string) => e === "ann@acme.com");
    prisma.intentAutomationOutreach.findFirst.mockResolvedValue({ id: "recent" });
    await service.runAutomation("a1", "MANUAL");
    const reasons = savedLeads().filter((l: any) => l.outcome === "SKIPPED").map((l: any) => `${l.companyName}:${l.skipReason}`);
    expect(reasons).toEqual(expect.arrayContaining(["Acme:SUPPRESSED", "Initech:RECENTLY_CONTACTED", "Hooli:RECENTLY_CONTACTED", "Globex:NO_EMAIL"]));
  });

  it("keeps the searched data even when the AI key is missing", async () => {
    ai.isConfigured.mockReturnValue(false);
    await service.runAutomation("a1", "MANUAL");
    const leads = savedLeads();
    expect(leads.length).toBe(4);
    expect(leads.every((l: any) => l.outcome === "SKIPPED" && l.skipReason === "AI_NOT_CONFIGURED")).toBe(true);
  });

  it("adds every lead that has an email to the CRM contacts, even ones that were skipped", async () => {
    prisma.contact.findFirst.mockResolvedValue(null);
    suppression.isSuppressed.mockImplementation(async (e: string) => e === "ann@acme.com");
    await service.runAutomation("a1", "MANUAL");
    const emails = prisma.contact.create.mock.calls.map((c: any) => c[0].data.email).sort();
    // Acme (suppressed -> skipped), Initech, Hooli (over the cap -> skipped); Globex has no email, the sample row is dropped
    expect(emails).toEqual(["ann@acme.com", "bob@initech.com", "cat@hooli.com"]);
    expect(prisma.contact.create.mock.calls[0][0].data).toMatchObject({ source: "APOLLO", companyId: "co1" });
  });

  it("does not duplicate contacts that already exist", async () => {
    prisma.contact.findFirst.mockResolvedValue({ id: "existing" });
    await service.runAutomation("a1", "MANUAL");
    expect(prisma.contact.create).not.toHaveBeenCalled();
  });

  it("autoSend sends immediately and records SENT", async () => {
    prisma.intentAutomation.findUnique.mockResolvedValue(automation({ autoSend: true }));
    const run: any = await service.runAutomation("a1", "MANUAL");
    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(run).toMatchObject({ sent: 2, queued: 0 });
    expect(prisma.intentAutomationOutreach.update.mock.calls.every((c: any) => c[0].data.status === IntentOutreachStatus.SENT)).toBe(true);
    expect(sendMail.mock.calls[0][0].html).toContain("Unsubscribe");
    expect(savedLeads().filter((l: any) => l.outcome === "SENT")).toHaveLength(2);
  });

  it("skips suppressed addresses, recent contacts (cooldown) and hand-sent mail", async () => {
    suppression.isSuppressed.mockImplementation(async (e: string) => e === "ann@acme.com");
    prisma.intentAutomationOutreach.findFirst.mockResolvedValue({ id: "recent" });
    const run: any = await service.runAutomation("a1", "MANUAL");
    expect(ai.generateDraft).not.toHaveBeenCalled();
    expect(run.queued).toBe(0);
    expect(run.skipped).toBeGreaterThan(0);
  });

  it("fails the run clearly (and sends nothing) when the AI key is missing", async () => {
    ai.isConfigured.mockReturnValue(false);
    const run: any = await service.runAutomation("a1", "MANUAL");
    expect(run).toMatchObject({ status: "FAILED" });
    expect(run.error).toMatch(/ANTHROPIC_API_KEY/);
    expect(sendMail).not.toHaveBeenCalled();
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining("failed") }));
  });

  it("does not draft anything when today's cap is already used", async () => {
    prisma.intentAutomationOutreach.count.mockResolvedValue(2);
    const run: any = await service.runAutomation("a1", "MANUAL");
    expect(ai.generateDraft).not.toHaveBeenCalled();
    expect(run.queued).toBe(0);
  });
});

describe("IntentAutomationService permissions & validation", () => {
  let prisma: any;
  let service: IntentAutomationService;
  beforeEach(() => {
    prisma = {
      intentAutomation: { findUnique: jest.fn().mockResolvedValue({ id: "a1", createdById: "owner" }), create: jest.fn().mockResolvedValue({}) },
      intentAutomationOutreach: { findUnique: jest.fn() },
    };
    service = new IntentAutomationService(prisma, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, { get: jest.fn() } as any);
  });

  const dto = (over: Record<string, unknown> = {}) =>
    ({ name: "n", source: "HIRING", roles: ["Dev"], frequency: "DAILY", timeOfDay: "09:00", offerDescription: "We place developers at companies.", ...over }) as any;

  it("only Recruitment/Sales/Admin may create", async () => {
    await expect(service.create(dto(), user("u", RoleName.EMPLOYEE, "Marketing"))).rejects.toThrow(ForbiddenException);
    await expect(service.create(dto(), user("u", RoleName.EMPLOYEE, "Sales"))).resolves.toBeDefined();
  });

  it("requires roles for hiring and keywords for news", async () => {
    await expect(service.create(dto({ roles: [] }), user("u"))).rejects.toThrow(BadRequestException);
    await expect(service.create(dto({ source: "NEWS", roles: [] }), user("u"))).rejects.toThrow(BadRequestException);
    await expect(service.create(dto({ source: "BOTH" }), user("u"))).rejects.toThrow(BadRequestException);
    await expect(service.create(dto({ source: "NEWS", roles: [], newsKeywords: "fintech" }), user("u"))).resolves.toBeDefined();
  });

  it("a colleague cannot run, change or approve someone else's automation; admin can", async () => {
    await expect(service.runNow("a1", user("other"))).rejects.toThrow(ForbiddenException);
    await expect(service.remove("a1", user("other"))).rejects.toThrow(ForbiddenException);
    prisma.intentAutomationOutreach.findUnique.mockResolvedValue({ id: "o1", status: "PENDING_APPROVAL", automation: { createdById: "owner" } });
    await expect(service.approve("o1", user("other"))).rejects.toThrow(ForbiddenException);
    await expect(service.reject("o1", user("other"))).rejects.toThrow(ForbiddenException);
  });
});
