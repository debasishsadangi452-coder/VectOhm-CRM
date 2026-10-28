import { sendEmail, sendFailureMessage } from "./mailer";

const msg = { to: "ken@wati.io", subject: "Hi", html: "<p>Hi</p>" };

describe("sendEmail failure reporting", () => {
  const realFetch = global.fetch;
  const env = { ...process.env };
  afterEach(() => {
    global.fetch = realFetch;
    process.env = { ...env };
  });

  it("surfaces Resend's own explanation instead of just the provider name", async () => {
    process.env.RESEND_API_KEY = "re_test";
    delete process.env.SENDGRID_API_KEY;
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ statusCode: 403, message: "You can only send testing emails to your own email address. Verify a domain at resend.com/domains." }), { status: 403 }),
    ) as unknown as typeof fetch;

    const result = await sendEmail(msg);
    expect(result).toMatchObject({ delivered: false, provider: "resend" });
    expect(result.error).toMatch(/^403 You can only send testing emails/);
    expect(sendFailureMessage(result)).toBe(`Stopgap HTTP sender failed (resend): ${result.error}`);
  });

  it("reports a network error", async () => {
    process.env.RESEND_API_KEY = "re_test";
    global.fetch = jest.fn().mockRejectedValue(new Error("getaddrinfo ENOTFOUND api.resend.com")) as unknown as typeof fetch;
    const result = await sendEmail(msg);
    expect(result).toMatchObject({ delivered: false, provider: "error", error: "getaddrinfo ENOTFOUND api.resend.com" });
  });

  it("says so when no provider is configured", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.SENDGRID_API_KEY;
    const result = await sendEmail(msg);
    expect(result).toMatchObject({ delivered: false, provider: "none" });
    expect(sendFailureMessage(result)).toMatch(/No email provider is configured/);
  });

  it("returns delivered on success", async () => {
    process.env.RESEND_API_KEY = "re_test";
    global.fetch = jest.fn().mockResolvedValue(new Response("{}", { status: 200 })) as unknown as typeof fetch;
    expect(await sendEmail(msg)).toEqual({ delivered: true, provider: "resend" });
  });
});
