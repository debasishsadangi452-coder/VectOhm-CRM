import { BulkSendStatus } from "@prisma/client";
import { BulkEmailEngineService } from "./bulk-email-engine.service";

// Per-recipient AI personalisation inside the sending engine. Kept apart from the main engine spec because
// it needs nothing from the mailer (an SMTP send is used), so it runs anywhere.

function makeRecipient(campaignOver: Record<string, unknown> = {}) {
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
      bodyHtml: "Hello {{firstName}} at {{companyName}}, we help teams hire faster.",
      appendSignature: false,
      aiPersonalize: false,
      aiInstructions: null,
      creator: { emailSignatureHtml: null },
      ...campaignOver,
    },
    contact: { firstName: "Jane", lastName: "Doe", title: "CTO", company: { name: "Acme" } },
  };
}

function makeEngine(recipient: ReturnType<typeof makeRecipient>, withAi = true) {
  const prisma = {
    bulkEmailRecipient: {
      findMany: jest.fn().mockResolvedValue([recipient]),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const transporter = { sendMail: jest.fn().mockResolvedValue({ messageId: "m1" }) };
  const emailAi = { personalizeForSend: jest.fn() };
  const engine = new BulkEmailEngineService(
    prisma as never,
    { isSuppressed: jest.fn().mockResolvedValue(false) } as never,
    { requireSendable: jest.fn().mockResolvedValue({ mode: "smtp", transporter, from: "Sam <sam@x.com>" }) } as never,
    { sendMail: jest.fn() } as never,
    { get: jest.fn(() => "https://crm.example.com") } as never,
    { record: jest.fn().mockResolvedValue({}) } as never,
    undefined,
    withAi ? (emailAi as never) : undefined,
  );
  return { engine, transporter, emailAi, prisma };
}

describe("BulkEmailEngineService — AI personalisation", () => {
  it("does not call the AI unless the campaign asked for it", async () => {
    const { engine, emailAi, transporter } = makeEngine(makeRecipient());
    await engine.runOnce();
    expect(emailAi.personalizeForSend).not.toHaveBeenCalled();
    expect(transporter.sendMail.mock.calls[0][0].subject).toBe("Hi Jane");
  });

  it("sends the AI's tailored email, giving it the merged copy and the recipient's details", async () => {
    const { engine, emailAi, transporter } = makeEngine(
      makeRecipient({ aiPersonalize: true, aiInstructions: "we place Java developers" }),
    );
    emailAi.personalizeForSend.mockResolvedValue({ subject: "Jane, a quick idea for Acme", body: "Tailored for a CTO at Acme." });
    await engine.runOnce();

    const [req, userId] = emailAi.personalizeForSend.mock.calls[0];
    expect(userId).toBe("u1");
    expect(req).toMatchObject({
      baseSubject: "Hi Jane",
      baseBody: "Hello Jane at Acme, we help teams hire faster.",
      recipient: { firstName: "Jane", lastName: "Doe", title: "CTO", companyName: "Acme" },
      instructions: "we place Java developers",
    });
    const sent = transporter.sendMail.mock.calls[0][0];
    expect(sent.subject).toBe("Jane, a quick idea for Acme");
    expect(sent.html).toContain("Tailored for a CTO at Acme.");
  });

  it("sends the original email unchanged when the AI is unavailable or returns nothing usable", async () => {
    const { engine, emailAi, transporter, prisma } = makeEngine(makeRecipient({ aiPersonalize: true }));
    emailAi.personalizeForSend.mockResolvedValue(null);
    await engine.runOnce();
    expect(transporter.sendMail.mock.calls[0][0].subject).toBe("Hi Jane");
    expect(prisma.bulkEmailRecipient.update.mock.calls.at(-1)![0].data.status).toBe(BulkSendStatus.SENT);
  });

  it("gives the AI plain text for a paragraph-only body (what the Bulk Email composer saves), and sends it back as HTML", async () => {
    const { engine, emailAi, transporter } = makeEngine(
      makeRecipient({ aiPersonalize: true, bodyHtml: "<p>Hello {{firstName}}</p>\n<p>Line one<br />Line two &amp; more</p>" }),
    );
    emailAi.personalizeForSend.mockResolvedValue({ subject: "Jane, hi", body: "Hi Jane,\n\nTailored text." });
    await engine.runOnce();
    expect(emailAi.personalizeForSend.mock.calls[0][0].baseBody).toBe("Hello Jane\n\nLine one\nLine two & more");
    const html = transporter.sendMail.mock.calls[0][0].html;
    expect(html).toContain("<p");
    expect(html).toContain("Tailored text.");
  });

  it("leaves a body with real markup (links, images, tables) alone rather than risk breaking it", async () => {
    const { engine, emailAi, transporter } = makeEngine(
      makeRecipient({ aiPersonalize: true, bodyHtml: '<p>Hello {{firstName}}</p><p><a href="https://x.com">Our site</a></p>' }),
    );
    await engine.runOnce();
    expect(emailAi.personalizeForSend).not.toHaveBeenCalled();
    expect(transporter.sendMail).toHaveBeenCalled();
  });

  it("still sends normally when the engine has no AI service at all", async () => {
    const { engine, transporter } = makeEngine(makeRecipient({ aiPersonalize: true }), false);
    await engine.runOnce();
    expect(transporter.sendMail.mock.calls[0][0].subject).toBe("Hi Jane");
  });
});
