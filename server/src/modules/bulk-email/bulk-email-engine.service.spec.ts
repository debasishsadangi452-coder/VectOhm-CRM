import { BulkSendStatus } from "@prisma/client";
import { BulkEmailEngineService } from "./bulk-email-engine.service";
import { sendEmail } from "../../common/utils/mailer";

jest.mock("../../common/utils/mailer", () => ({
  ...jest.requireActual("../../common/utils/mailer"),
  sendEmail: jest.fn(),
}));
const sendEmailMock = sendEmail as jest.Mock;

type Over = Record<string, unknown>;

function makeRecipient(over: Over = {}, campaignOver: Over = {}) {
  return {
    id: "r1",
    email: "jane@acme.com",
    contactId: "c1",
    status: BulkSendStatus.PENDING,
    campaign: {
      id: "camp1",
      creatorId: "u1",
      template: null,
      subject: "Hi {{firstName}}",
      bodyHtml: "Hello {{firstName}} {{lastName}} at {{companyName}}",
      appendSignature: false,
      creator: { emailSignatureHtml: "<b>Best, Sam</b>" },
      ...campaignOver,
    },
    contact: { firstName: "Jane", lastName: "Doe", title: "CTO", company: { name: "Acme" } },
    ...over,
  };
}

function makeEngine(pending: unknown[] = [makeRecipient()]) {
  const prisma = {
    bulkEmailRecipient: {
      findMany: jest.fn().mockResolvedValue(pending),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const suppression = { isSuppressed: jest.fn().mockResolvedValue(false) };
  const transporter = { sendMail: jest.fn().mockResolvedValue({}) };
  const emailConnections = {
    requireSendable: jest.fn().mockResolvedValue({ mode: "smtp", transporter, from: "Sam <sam@x.com>" }),
  };
  const emailOAuth = { sendMail: jest.fn().mockResolvedValue({ messageId: "m1", threadId: "t1" }) };
  const settings: Record<string, string | undefined> = { APP_URL: "https://crm.example.com/" };
  const config = { get: jest.fn((k: string) => settings[k]) };
  const engagementEvents = { record: jest.fn().mockResolvedValue({}) };

  const engine = new BulkEmailEngineService(
    prisma as never,
    suppression as never,
    emailConnections as never,
    emailOAuth as never,
    config as never,
    engagementEvents as never,
  );
  return { engine, prisma, suppression, transporter, emailConnections, emailOAuth, settings, engagementEvents };
}

const lastUpdate = (prisma: ReturnType<typeof makeEngine>["prisma"]) =>
  prisma.bulkEmailRecipient.update.mock.calls.at(-1)![0];

beforeAll(() => {
  process.env.APP_ENCRYPTION_KEY = "a".repeat(64);
});

beforeEach(() => {
  sendEmailMock.mockReset();
  // The engine logs failures; keep test output readable.
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("BulkEmailEngineService.runOnce — batching", () => {
  it("takes the oldest PENDING recipients, capped at 50", async () => {
    const { engine, prisma } = makeEngine([]);
    const result = await engine.runOnce();

    const query = prisma.bulkEmailRecipient.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ status: BulkSendStatus.PENDING });
    expect(query.orderBy).toEqual({ createdAt: "asc" });
    expect(query.take).toBe(50);
    expect(result).toEqual({ processed: 0 });
  });

  it("reports how many recipients it processed", async () => {
    const { engine } = makeEngine([makeRecipient({ id: "a" }), makeRecipient({ id: "b" })]);
    expect(await engine.runOnce()).toEqual({ processed: 2 });
  });

  it("keeps going when one recipient blows up", async () => {
    const { engine, suppression, transporter } = makeEngine([makeRecipient({ id: "a" }), makeRecipient({ id: "b" })]);
    suppression.isSuppressed.mockRejectedValueOnce(new Error("db hiccup")).mockResolvedValue(false);

    await expect(engine.runOnce()).resolves.toEqual({ processed: 2 });
    expect(transporter.sendMail).toHaveBeenCalledTimes(1); // "b" still went out
  });

  it("the cron tick just runs the same pass", async () => {
    const { engine, prisma } = makeEngine([]);
    await engine.handleCron();
    expect(prisma.bulkEmailRecipient.findMany).toHaveBeenCalled();
  });
});

describe("BulkEmailEngineService — suppression", () => {
  it("SKIPS a suppressed address without sending", async () => {
    const { engine, prisma, suppression, transporter, engagementEvents } = makeEngine();
    suppression.isSuppressed.mockResolvedValue(true);
    await engine.runOnce();

    expect(suppression.isSuppressed).toHaveBeenCalledWith("jane@acme.com");
    expect(lastUpdate(prisma)).toMatchObject({
      where: { id: "r1" },
      data: { status: BulkSendStatus.SKIPPED, errorMessage: "Email address is suppressed" },
    });
    expect(transporter.sendMail).not.toHaveBeenCalled();
    expect(engagementEvents.record).not.toHaveBeenCalled();
  });
});

describe("BulkEmailEngineService — rendering", () => {
  it("personalises subject and body from the contact", async () => {
    const { engine, transporter } = makeEngine();
    await engine.runOnce();
    const mail = transporter.sendMail.mock.calls[0][0];
    expect(mail.subject).toBe("Hi Jane");
    expect(mail.html).toContain("Hello Jane Doe at Acme");
    expect(mail.to).toBe("jane@acme.com");
    expect(mail.from).toBe("Sam <sam@x.com>");
  });

  it("blanks merge fields for a pasted address with no CRM contact", async () => {
    const { engine, transporter, engagementEvents } = makeEngine([makeRecipient({ contactId: null, contact: null })]);
    await engine.runOnce();
    const mail = transporter.sendMail.mock.calls[0][0];
    expect(mail.subject).toBe("Hi ");
    expect(mail.html).not.toContain("{{");
    expect(engagementEvents.record).not.toHaveBeenCalled(); // no contact to attach it to
  });

  it("prefers a saved template over the campaign's own fields", async () => {
    const template = { subject: "Template {{firstName}}", bodyHtml: "<p>From template</p>", appendSignature: false };
    const { engine, transporter } = makeEngine([makeRecipient({}, { template })]);
    await engine.runOnce();
    const mail = transporter.sendMail.mock.calls[0][0];
    expect(mail.subject).toBe("Template Jane");
    expect(mail.html).toContain("From template");
  });

  it("turns plain-text line breaks into HTML paragraphs", async () => {
    const { engine, transporter } = makeEngine([makeRecipient({}, { bodyHtml: "Line one\nLine two\n\nNew para" })]);
    await engine.runOnce();
    const html = transporter.sendMail.mock.calls[0][0].html;
    expect(html).toContain("Line one<br />Line two");
    expect(html.match(/<p /g)!.length).toBeGreaterThanOrEqual(2);
  });

  it("appends the creator's signature only when asked", async () => {
    const withSig = makeEngine([makeRecipient({}, { appendSignature: true })]);
    await withSig.engine.runOnce();
    expect(withSig.transporter.sendMail.mock.calls[0][0].html).toContain("<b>Best, Sam</b>");

    const withoutSig = makeEngine([makeRecipient({}, { appendSignature: false })]);
    await withoutSig.engine.runOnce();
    expect(withoutSig.transporter.sendMail.mock.calls[0][0].html).not.toContain("Best, Sam");
  });

  it("takes the signature flag from a saved template when one is used", async () => {
    const template = { subject: "S", bodyHtml: "Body", appendSignature: true };
    const { engine, transporter } = makeEngine([makeRecipient({}, { template, appendSignature: false })]);
    await engine.runOnce();
    expect(transporter.sendMail.mock.calls[0][0].html).toContain("Best, Sam");
  });

  it("adds an unsubscribe link, open pixel and click tracking", async () => {
    const { engine, transporter } = makeEngine([
      makeRecipient({}, { bodyHtml: 'See <a href="https://acme.com/jobs">jobs</a> or <a href="mailto:a@b.com">mail</a>' }),
    ]);
    await engine.runOnce();
    const html: string = transporter.sendMail.mock.calls[0][0].html;

    expect(html).toContain("https://crm.example.com/unsubscribe?email=jane%40acme.com&token=");
    expect(html).toContain('src="https://crm.example.com/api/tracking/open/bulk/r1"');
    expect(html).toContain(
      `href="https://crm.example.com/api/tracking/click/bulk/r1?url=${encodeURIComponent("https://acme.com/jobs")}"`,
    );
    expect(html).toContain('href="mailto:a@b.com"'); // not click-tracked
  });

  it("falls back to CORS_ORIGIN, then localhost, for the public base URL", async () => {
    const viaCors = makeEngine();
    viaCors.settings.APP_URL = undefined;
    viaCors.settings.CORS_ORIGIN = "https://cors.example.com";
    await viaCors.engine.runOnce();
    expect(viaCors.transporter.sendMail.mock.calls[0][0].html).toContain("https://cors.example.com/api/tracking/open/bulk/r1");

    const fallback = makeEngine();
    fallback.settings.APP_URL = undefined;
    await fallback.engine.runOnce();
    expect(fallback.transporter.sendMail.mock.calls[0][0].html).toContain("http://localhost:8080/api/tracking/open/bulk/r1");
  });
});

describe("BulkEmailEngineService — missing content", () => {
  it("FAILS a recipient whose campaign has no content, without sending", async () => {
    const { engine, prisma, transporter } = makeEngine([
      makeRecipient({}, { template: null, subject: null, bodyHtml: null }),
    ]);
    await engine.runOnce();
    expect(lastUpdate(prisma).data).toMatchObject({
      status: BulkSendStatus.FAILED,
      errorMessage: expect.stringContaining("no email content"),
    });
    expect(transporter.sendMail).not.toHaveBeenCalled();
  });
});

describe("BulkEmailEngineService — sending", () => {
  it("marks SMTP sends SENT and records the engagement event", async () => {
    const { engine, prisma, engagementEvents, emailConnections } = makeEngine();
    await engine.runOnce();

    expect(emailConnections.requireSendable).toHaveBeenCalledWith("u1", undefined); // the campaign creator's mailbox
    expect(lastUpdate(prisma).data).toMatchObject({
      status: BulkSendStatus.SENT,
      errorMessage: null,
      providerMessageId: null,
      threadId: null,
    });
    expect(lastUpdate(prisma).data.sentAt).toBeInstanceOf(Date);
    expect(engagementEvents.record).toHaveBeenCalledWith({
      type: "EMAIL_SENT",
      contactId: "c1",
      campaignId: "camp1",
      recipientId: "r1",
      ownerId: "u1",
    });
  });

  it("sends through OAuth and keeps the provider message and thread ids", async () => {
    const { engine, prisma, emailConnections, emailOAuth, transporter } = makeEngine();
    emailConnections.requireSendable.mockResolvedValue({
      mode: "oauth",
      provider: "google",
      accessToken: "tok",
      from: "Sam <sam@x.com>",
    });
    await engine.runOnce();

    expect(transporter.sendMail).not.toHaveBeenCalled();
    expect(emailOAuth.sendMail).toHaveBeenCalledWith(
      "google",
      "tok",
      expect.objectContaining({ to: "jane@acme.com", subject: "Hi Jane", from: "Sam <sam@x.com>" }),
    );
    expect(lastUpdate(prisma).data).toMatchObject({
      status: BulkSendStatus.SENT,
      providerMessageId: "m1",
      threadId: "t1",
    });
  });

  it("sends through the shared HTTP sender with the creator as reply-to", async () => {
    const { engine, prisma, emailConnections } = makeEngine();
    emailConnections.requireSendable.mockResolvedValue({ mode: "http", replyTo: "sam@x.com" });
    sendEmailMock.mockResolvedValue({ delivered: true, provider: "resend" });
    await engine.runOnce();

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "jane@acme.com", subject: "Hi Jane", replyTo: "sam@x.com" }),
    );
    expect(lastUpdate(prisma).data.status).toBe(BulkSendStatus.SENT);
  });

  it("FAILS when the HTTP sender reports not delivered", async () => {
    const { engine, prisma, emailConnections, engagementEvents } = makeEngine();
    emailConnections.requireSendable.mockResolvedValue({ mode: "http", replyTo: "sam@x.com" });
    sendEmailMock.mockResolvedValue({
      delivered: false,
      provider: "resend",
      error: "403 You can only send testing emails to your own email address.",
    });
    await engine.runOnce();

    // The recipient row now carries Resend's own reason, not just the provider name.
    expect(lastUpdate(prisma).data).toMatchObject({
      status: BulkSendStatus.FAILED,
      errorMessage: "Stopgap HTTP sender failed (resend): 403 You can only send testing emails to your own email address.",
    });
    expect(engagementEvents.record).not.toHaveBeenCalled();
  });

  it("FAILS with the reason when the mailbox isn't connected", async () => {
    const { engine, prisma, transporter, emailConnections } = makeEngine();
    emailConnections.requireSendable.mockRejectedValue(new Error("Email account not connected"));
    await engine.runOnce();

    expect(lastUpdate(prisma).data).toMatchObject({
      status: BulkSendStatus.FAILED,
      errorMessage: "Email account not connected",
    });
    expect(transporter.sendMail).not.toHaveBeenCalled();
  });

  it("FAILS with the provider's error when SMTP delivery throws", async () => {
    const { engine, prisma, transporter, engagementEvents } = makeEngine();
    transporter.sendMail.mockRejectedValue(new Error("550 mailbox unavailable"));
    await engine.runOnce();

    expect(lastUpdate(prisma).data).toMatchObject({
      status: BulkSendStatus.FAILED,
      errorMessage: "550 mailbox unavailable",
    });
    expect(engagementEvents.record).not.toHaveBeenCalled();
  });

  it("never marks a recipient SENT unless delivery succeeded", async () => {
    const { engine, prisma, transporter } = makeEngine([makeRecipient({ id: "a" }), makeRecipient({ id: "b" })]);
    transporter.sendMail.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({});
    await engine.runOnce();

    const byId = Object.fromEntries(
      prisma.bulkEmailRecipient.update.mock.calls.map(([c]: [{ where: { id: string }; data: { status: string } }]) => [
        c.where.id,
        c.data.status,
      ]),
    );
    expect(byId).toEqual({ a: BulkSendStatus.FAILED, b: BulkSendStatus.SENT });
  });
});
