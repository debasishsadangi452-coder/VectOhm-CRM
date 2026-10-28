import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { BulkSendStatus } from "@prisma/client";
import { BulkEmailService } from "./bulk-email.service";
import type { RequestUser } from "../../common/types/request-user.type";

const makeUser = (role: string, department: string | null, id = "u1") =>
  ({
    id,
    email: `${id}@x.com`,
    firstName: "Test",
    lastName: "User",
    role: { id: "r", name: role },
    department: department ? { id: "d", name: department, managerTitle: "Manager" } : null,
  }) as unknown as RequestUser;

const recruiter = makeUser("EMPLOYEE", "Recruitment", "rec1");
const salesRep = makeUser("EMPLOYEE", "Sales", "sales1");
const recruitmentManager = makeUser("MANAGER", "Recruitment", "mgr1");
const admin = makeUser("ADMIN", null, "admin1");

function makeService() {
  const prisma = {
    bulkEmailCampaign: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "camp1", ...data })),
    },
    bulkEmailRecipient: {
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    contact: { findMany: jest.fn().mockResolvedValue([]) },
    emailTemplate: { findFirst: jest.fn().mockResolvedValue({ id: "tpl1" }) },
  };
  const emailConnections = {
    getStatus: jest.fn().mockResolvedValue({ connected: true, verified: true }),
    hasHttpFallback: jest.fn().mockReturnValue(false),
  };
  const service = new BulkEmailService(prisma as never, emailConnections as never);
  return { service, prisma, emailConnections };
}

const inline = { name: "Spring push", subject: "Hi {{firstName}}", bodyHtml: "Hello there" };

describe("BulkEmailService — access control", () => {
  it.each([
    ["Recruitment employee", recruiter],
    ["Sales employee", salesRep],
    ["Recruitment manager", recruitmentManager],
    ["Admin (no department)", admin],
    ["department named with extra words", makeUser("EMPLOYEE", "Talent Recruitment Team", "x")],
  ])("allows %s", async (_label, user) => {
    const { service } = makeService();
    await expect(service.findAll(user)).resolves.toEqual([]);
  });

  it.each([
    ["HR", makeUser("EMPLOYEE", "HR")],
    ["Development", makeUser("EMPLOYEE", "Development")],
    ["Digital Marketing", makeUser("MANAGER", "Digital Marketing")],
    ["no department", makeUser("EMPLOYEE", null)],
  ])("blocks every operation for %s", async (_label, user) => {
    const { service, prisma } = makeService();
    await expect(service.findAll(user)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.findOne("c1", user)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.create({ ...inline, rawEmails: ["a@x.com"] }, user)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.findFollowUps(user)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.dismissFollowUp("r1", user)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.bulkEmailCampaign.create).not.toHaveBeenCalled();
  });
});

describe("BulkEmailService.create — recipients", () => {
  it("queues PENDING recipients for pasted emails, lower-cased and trimmed", async () => {
    const { service, prisma } = makeService();
    await service.create({ ...inline, rawEmails: ["  Jane@Acme.COM ", "bob@acme.com"] }, recruiter);

    const data = prisma.bulkEmailCampaign.create.mock.calls[0][0].data;
    expect(data.recipients.create).toEqual([
      { email: "jane@acme.com", contactId: null, status: BulkSendStatus.PENDING },
      { email: "bob@acme.com", contactId: null, status: BulkSendStatus.PENDING },
    ]);
    expect(data.creatorId).toBe("rec1");
  });

  it("de-duplicates pasted emails regardless of case", async () => {
    const { service, prisma } = makeService();
    await service.create({ ...inline, rawEmails: ["a@x.com", "A@X.com", " a@x.com "] }, recruiter);
    expect(prisma.bulkEmailCampaign.create.mock.calls[0][0].data.recipients.create).toHaveLength(1);
  });

  it("resolves contact ids to their emails and keeps the contact link", async () => {
    const { service, prisma } = makeService();
    prisma.contact.findMany.mockResolvedValue([{ id: "c1", email: "Jane@Acme.com" }]);
    await service.create({ ...inline, contactIds: ["c1"] }, recruiter);

    expect(prisma.contact.findMany.mock.calls[0][0].where).toEqual({ id: { in: ["c1"] } });
    expect(prisma.bulkEmailCampaign.create.mock.calls[0][0].data.recipients.create).toEqual([
      { email: "jane@acme.com", contactId: "c1", status: BulkSendStatus.PENDING },
    ]);
  });

  it("skips contacts that have no email on file", async () => {
    const { service, prisma } = makeService();
    prisma.contact.findMany.mockResolvedValue([
      { id: "c1", email: null },
      { id: "c2", email: "ok@x.com" },
    ]);
    await service.create({ ...inline, contactIds: ["c1", "c2"] }, recruiter);
    const rows = prisma.bulkEmailCampaign.create.mock.calls[0][0].data.recipients.create;
    expect(rows).toHaveLength(1);
    expect(rows[0].contactId).toBe("c2");
  });

  it("keeps the CRM contact when the same address is also pasted (so merge fields still work)", async () => {
    const { service, prisma } = makeService();
    prisma.contact.findMany.mockResolvedValue([{ id: "c1", email: "jane@acme.com" }]);
    await service.create({ ...inline, contactIds: ["c1"], rawEmails: ["JANE@acme.com"] }, recruiter);
    expect(prisma.bulkEmailCampaign.create.mock.calls[0][0].data.recipients.create).toEqual([
      { email: "jane@acme.com", contactId: "c1", status: BulkSendStatus.PENDING },
    ]);
  });

  it("combines contacts and pasted emails into one deduped set", async () => {
    const { service, prisma } = makeService();
    prisma.contact.findMany.mockResolvedValue([{ id: "c1", email: "a@x.com" }]);
    await service.create({ ...inline, contactIds: ["c1"], rawEmails: ["b@x.com", "a@x.com"] }, recruiter);
    const emails = prisma.bulkEmailCampaign.create.mock.calls[0][0].data.recipients.create.map(
      (r: { email: string }) => r.email,
    );
    expect(emails).toEqual(["a@x.com", "b@x.com"]);
  });

  it("rejects when nothing resolves to a recipient", async () => {
    const { service, prisma } = makeService();
    prisma.contact.findMany.mockResolvedValue([{ id: "c1", email: null }]);
    await expect(service.create({ ...inline, contactIds: ["c1"] }, recruiter)).rejects.toThrow(
      /No valid recipients/,
    );
    await expect(service.create({ ...inline }, recruiter)).rejects.toThrow(/No valid recipients/);
    expect(prisma.bulkEmailCampaign.create).not.toHaveBeenCalled();
  });
});

describe("BulkEmailService.create — email content", () => {
  const withRecipient = { rawEmails: ["a@x.com"] };

  it("stores an inline one-off on the campaign with no template", async () => {
    const { service, prisma } = makeService();
    await service.create({ ...inline, ...withRecipient }, recruiter);
    const data = prisma.bulkEmailCampaign.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      name: "Spring push",
      templateId: null,
      subject: "Hi {{firstName}}",
      bodyHtml: "Hello there",
    });
    expect(prisma.emailTemplate.findFirst).not.toHaveBeenCalled();
  });

  it("uses a saved template and stores no inline content", async () => {
    const { service, prisma } = makeService();
    await service.create({ name: "N", templateId: "tpl1", ...withRecipient }, recruiter);
    const data = prisma.bulkEmailCampaign.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ templateId: "tpl1", subject: null, bodyHtml: null });
  });

  it("only accepts a template the sender can see (their own or shared with them)", async () => {
    const { service, prisma } = makeService();
    await service.create({ name: "N", templateId: "tpl1", ...withRecipient }, recruiter);
    const where = prisma.emailTemplate.findFirst.mock.calls[0][0].where;
    expect(where.id).toBe("tpl1");
    expect(where.OR).toEqual(expect.arrayContaining([{ creatorId: recruiter.id }, { visibility: "EVERYONE" }]));
  });

  it("stores AI personalisation only when switched on", async () => {
    const { service, prisma } = makeService();
    await service.create({ ...inline, ...withRecipient, aiPersonalize: true, aiInstructions: "  we place Java devs " }, recruiter);
    expect(prisma.bulkEmailCampaign.create.mock.calls[0][0].data).toMatchObject({
      aiPersonalize: true,
      aiInstructions: "we place Java devs",
    });
    await service.create({ ...inline, ...withRecipient, aiPersonalize: false, aiInstructions: "ignored" }, recruiter);
    expect(prisma.bulkEmailCampaign.create.mock.calls[1][0].data).toMatchObject({
      aiPersonalize: false,
      aiInstructions: null,
    });
  });

  it("rejects a template combined with inline content", async () => {
    const { service } = makeService();
    await expect(
      service.create({ name: "N", templateId: "tpl1", subject: "S", ...withRecipient }, recruiter),
    ).rejects.toThrow(/either a saved template or a one-off/);
    await expect(
      service.create({ name: "N", templateId: "tpl1", bodyHtml: "B", ...withRecipient }, recruiter),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects an unknown template", async () => {
    const { service, prisma } = makeService();
    prisma.emailTemplate.findFirst.mockResolvedValue(null);
    await expect(service.create({ name: "N", templateId: "nope", ...withRecipient }, recruiter)).rejects.toThrow(
      /template not found/i,
    );
  });

  it.each([
    ["nothing", {}],
    ["subject only", { subject: "S" }],
    ["body only", { bodyHtml: "B" }],
  ])("rejects an inline email with %s", async (_label, content) => {
    const { service } = makeService();
    await expect(service.create({ name: "N", ...content, ...withRecipient }, recruiter)).rejects.toThrow(
      /Pick a saved template, or write/,
    );
  });

  it("defaults appendSignature to false and passes followUpMode through", async () => {
    const { service, prisma } = makeService();
    await service.create({ ...inline, ...withRecipient }, recruiter);
    expect(prisma.bulkEmailCampaign.create.mock.calls[0][0].data.appendSignature).toBe(false);

    await service.create({ ...inline, ...withRecipient, appendSignature: true, followUpMode: "ASSISTED" }, recruiter);
    const data = prisma.bulkEmailCampaign.create.mock.calls[1][0].data;
    expect(data.appendSignature).toBe(true);
    expect(data.followUpMode).toBe("ASSISTED");
  });
});

describe("BulkEmailService.create — sender mailbox", () => {
  const args = { ...inline, rawEmails: ["a@x.com"] };

  it("refuses when the creator's mailbox isn't connected", async () => {
    const { service, emailConnections, prisma } = makeService();
    emailConnections.getStatus.mockResolvedValue({ connected: false, verified: false });
    await expect(service.create(args, recruiter)).rejects.toThrow(/Connect and verify your email account/);
    expect(prisma.bulkEmailCampaign.create).not.toHaveBeenCalled();
  });

  it("refuses when connected but not verified", async () => {
    const { service, emailConnections } = makeService();
    emailConnections.getStatus.mockResolvedValue({ connected: true, verified: false });
    await expect(service.create(args, recruiter)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("allows an unconnected user when the shared HTTP sender is configured", async () => {
    const { service, emailConnections, prisma } = makeService();
    emailConnections.getStatus.mockResolvedValue({ connected: false, verified: false });
    emailConnections.hasHttpFallback.mockReturnValue(true);
    await service.create(args, recruiter);
    expect(prisma.bulkEmailCampaign.create).toHaveBeenCalled();
  });

  it("checks the mailbox of the user creating the campaign", async () => {
    const { service, emailConnections } = makeService();
    await service.create(args, recruiter);
    expect(emailConnections.getStatus).toHaveBeenCalledWith(recruiter);
  });
});

describe("BulkEmailService.findAll / findOne", () => {
  it("attaches per-status counts to each campaign", async () => {
    const { service, prisma } = makeService();
    prisma.bulkEmailCampaign.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    prisma.bulkEmailRecipient.groupBy.mockResolvedValue([
      { campaignId: "a", status: "SENT", _count: 3 },
      { campaignId: "a", status: "FAILED", _count: 1 },
      { campaignId: "b", status: "PENDING", _count: 5 },
    ]);
    const result = await service.findAll(recruiter);
    expect(result).toEqual([
      { id: "a", statusCounts: { SENT: 3, FAILED: 1 } },
      { id: "b", statusCounts: { PENDING: 5 } },
    ]);
  });

  it("gives an empty count map to a campaign with no recipients", async () => {
    const { service, prisma } = makeService();
    prisma.bulkEmailCampaign.findMany.mockResolvedValue([{ id: "a" }]);
    expect(await service.findAll(recruiter)).toEqual([{ id: "a", statusCounts: {} }]);
  });

  it("findOne 404s for an unknown campaign", async () => {
    const { service } = makeService();
    await expect(service.findOne("nope", recruiter)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("findOne counts recipient statuses", async () => {
    const { service, prisma } = makeService();
    prisma.bulkEmailCampaign.findUnique.mockResolvedValue({
      id: "a",
      recipients: [{ status: "SENT" }, { status: "SENT" }, { status: "SKIPPED" }],
    });
    const result = await service.findOne("a", recruiter);
    expect(result.statusCounts).toEqual({ SENT: 2, SKIPPED: 1 });
  });
});

describe("BulkEmailService.findFollowUps", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-10T00:00:00Z"));
  });
  afterEach(() => jest.useRealTimers());

  it("asks only for sent, never-opened, undismissed, linked recipients older than 3 days", async () => {
    const { service, prisma } = makeService();
    await service.findFollowUps(admin);
    const where = prisma.bulkEmailRecipient.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      status: BulkSendStatus.SENT,
      openCount: 0,
      contactId: { not: null },
      dismissedAt: null,
    });
    expect(where.sentAt.lte).toEqual(new Date("2026-10-07T00:00:00Z"));
  });

  it("scopes an Employee to their own campaigns", async () => {
    const { service, prisma } = makeService();
    await service.findFollowUps(recruiter);
    expect(prisma.bulkEmailRecipient.findMany.mock.calls[0][0].where.campaign).toEqual({ creatorId: "rec1" });
  });

  it.each([
    ["Manager", recruitmentManager],
    ["Admin", admin],
  ])("does not scope a %s by creator", async (_label, user) => {
    const { service, prisma } = makeService();
    await service.findFollowUps(user);
    expect(prisma.bulkEmailRecipient.findMany.mock.calls[0][0].where.campaign).toBeUndefined();
  });
});

describe("BulkEmailService.dismissFollowUp", () => {
  it("404s for an unknown follow-up", async () => {
    const { service, prisma } = makeService();
    await expect(service.dismissFollowUp("nope", recruiter)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.bulkEmailRecipient.update).not.toHaveBeenCalled();
  });

  it("stops an Employee dismissing someone else's follow-up", async () => {
    const { service, prisma } = makeService();
    prisma.bulkEmailRecipient.findUnique.mockResolvedValue({ campaign: { creatorId: "someone-else" } });
    await expect(service.dismissFollowUp("r1", recruiter)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.bulkEmailRecipient.update).not.toHaveBeenCalled();
  });

  it("lets an Employee dismiss their own", async () => {
    const { service, prisma } = makeService();
    prisma.bulkEmailRecipient.findUnique.mockResolvedValue({ campaign: { creatorId: "rec1" } });
    await service.dismissFollowUp("r1", recruiter);
    const call = prisma.bulkEmailRecipient.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: "r1" });
    expect(call.data.dismissedAt).toBeInstanceOf(Date);
  });

  it("lets a Manager dismiss anyone's", async () => {
    const { service, prisma } = makeService();
    prisma.bulkEmailRecipient.findUnique.mockResolvedValue({ campaign: { creatorId: "someone-else" } });
    await service.dismissFollowUp("r1", recruitmentManager);
    expect(prisma.bulkEmailRecipient.update).toHaveBeenCalled();
  });
});
