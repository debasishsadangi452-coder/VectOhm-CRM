import { ServiceUnavailableException, UnprocessableEntityException } from "@nestjs/common";
import { EmailAiService } from "./email-ai.service";
import {
  buildPersonalizePrompt,
  buildRewritePrompt,
  buildTemplatePrompt,
  hasBadPlaceholder,
  parsePersonalized,
  parseRewrite,
  parseSubjects,
  parseTemplateDraft,
} from "./email-ai.prompts";

const json = (o: unknown) => JSON.stringify(o);

describe("email AI: output checks", () => {
  it("accepts a template that only uses the supported merge fields", () => {
    const draft = parseTemplateDraft(json({ name: "Intro", subject: "Hi {{firstName}}", body: "Hello {{firstName}} at {{companyName}}.\n\nBest regards," }));
    expect(draft).toMatchObject({ name: "Intro", subject: "Hi {{firstName}}" });
  });

  it("rejects unknown merge fields and leftover [Name]-style placeholders", () => {
    expect(parseTemplateDraft(json({ name: "A", subject: "Hi {{contactName}}", body: "Hello" }))).toBeNull();
    expect(parseTemplateDraft(json({ name: "A", subject: "Hi", body: "Hello [Name]" }))).toBeNull();
    expect(hasBadPlaceholder("Hello [Your Name]", true)).toBe(true);
    expect(hasBadPlaceholder("Hello {{firstName}}", true)).toBe(false);
  });

  it("tolerates code fences and surrounding prose around the JSON", () => {
    const wrapped = "Here you go:\n```json\n" + json({ name: "A", subject: "S", body: "B" }) + "\n```";
    expect(parseTemplateDraft(wrapped)).toMatchObject({ name: "A" });
    expect(parseTemplateDraft("not json at all")).toBeNull();
  });

  it("needs a subject back only when one was sent for a rewrite", () => {
    expect(parseRewrite(json({ body: "Short." }), false)).toEqual({ body: "Short." });
    expect(parseRewrite(json({ subject: "", body: "Short." }), true)).toBeNull();
    expect(parseRewrite(json({ subject: "New", body: "Short." }), true)).toEqual({ subject: "New", body: "Short." });
  });

  it("cleans subject suggestions: dedupes, drops bad ones, caps the count", () => {
    const text = json({ subjects: ["Quick idea", "quick idea", "", "Hello [Name]", "Second", "Third", "Fourth"] });
    expect(parseSubjects(text, 3)).toEqual(["Quick idea", "Second", "Third"]);
    expect(parseSubjects(json({ subjects: [] }), 3)).toBeNull();
  });

  it("holds a personalised email to a higher bar: no placeholders at all, sane length", () => {
    const original = { subject: "Hi Jane", body: "Hello Jane, we help teams hire faster. Want a quick call this week?" };
    expect(parsePersonalized(json({ subject: "Jane, quick idea", body: "Hello Jane, as CTO at Acme you may like how we help teams hire faster. Free for a call?" }), original)).not.toBeNull();
    expect(parsePersonalized(json({ subject: "Hi {{firstName}}", body: "Hello Jane, we help teams hire faster. Call?" }), original)).toBeNull();
    expect(parsePersonalized(json({ subject: "S", body: "Hi." }), original)).toBeNull(); // far too short
    expect(parsePersonalized(json({ subject: "S", body: "word ".repeat(400) }), original)).toBeNull(); // runaway
  });
});

describe("email AI: prompts", () => {
  it("tells the model the merge fields and bans invented facts and placeholders", () => {
    const p = buildTemplatePrompt({ goal: "Introduce our hiring service", tone: "warm", length: "short" });
    expect(p).toContain("{{firstName}}");
    expect(p).toContain("Do not invent facts");
    expect(p).toContain("60 to 90 words");
    expect(p).toContain("Introduce our hiring service");
  });

  it("covers each rewrite instruction", () => {
    expect(buildRewritePrompt({ body: "Hi", instruction: "SHORTER" })).toContain("shorter");
    expect(buildRewritePrompt({ body: "Hi", instruction: "TRANSLATE", language: "Hindi" })).toContain("Translate it into Hindi");
    expect(buildRewritePrompt({ body: "Hi", instruction: "CUSTOM", custom: "Sound excited" })).toContain("Sound excited");
  });

  it("gives the personaliser the recipient's role and company but no placeholders to fill", () => {
    const p = buildPersonalizePrompt({
      baseSubject: "Hi Jane",
      baseBody: "Hello Jane",
      recipient: { firstName: "Jane", lastName: "Doe", title: "CTO", companyName: "Acme" },
      instructions: "we place Java developers",
    });
    expect(p).toContain("Jane Doe (CTO) at Acme");
    expect(p).toContain("we place Java developers");
    expect(p).toContain("Do not invent facts");
  });
});

describe("EmailAiService", () => {
  const ENV = { ...process.env };
  afterEach(() => {
    process.env = { ...ENV };
  });
  const service = () => new EmailAiService({ recordUsage: jest.fn() } as never);

  it("reports whether the Gemini key is set", () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    expect(service().isConfigured()).toBe(false);
    process.env.GEMINI_API_KEY = "k";
    expect(service().isConfigured()).toBe(true);
  });

  it("explains clearly when there is no key (and never invents an email)", async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    await expect(service().generateTemplate({ goal: "x" }, "u1")).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("falls back to the original (null) when personalising during a send and there is no key", async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    const out = await service().personalizeForSend(
      { baseSubject: "S", baseBody: "B", recipient: { firstName: "J", lastName: "D", title: null, companyName: null } },
      "u1",
    );
    expect(out).toBeNull();
  });

  it("limits how often one person can call the AI", async () => {
    delete process.env.GEMINI_API_KEY;
    const s = service();
    let blocked = false;
    for (let i = 0; i < 45; i++) {
      try {
        await s.generateTemplate({ goal: "x" }, "heavy-user");
      } catch (e) {
        if (!(e instanceof ServiceUnavailableException) && !(e instanceof UnprocessableEntityException)) blocked = true;
      }
    }
    expect(blocked).toBe(true); // the 41st call is refused with "too many requests"
  });
});
