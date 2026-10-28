import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { EmailConnectionType } from "@prisma/client";
import { randomBytes } from "node:crypto";
import {
  EmailOAuthService,
  connectionTypeFor,
  providerFor,
  tokenLifetimeSeconds,
  zohoDomains,
} from "./email-oauth.service";
import { generateOAuthState } from "../../common/utils/oauth-state";
import { EmailConnectionsService } from "../email-connections/email-connections.service";
import { EmailSyncEngineService } from "./email-sync-engine.service";

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

describe("Zoho mail connection", () => {
  const realFetch = global.fetch;
  const env = { ...process.env };
  let fetchMock: jest.Mock;
  let prisma: any;
  let service: EmailOAuthService;

  beforeEach(() => {
    process.env.ZOHO_CLIENT_ID = "zid";
    process.env.ZOHO_CLIENT_SECRET = "zsecret";
    process.env.ZOHO_DC = "in";
    process.env.OAUTH_REDIRECT_BASE_URL = "https://crm.example.com/api";
    process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString("hex");
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    prisma = {
      userEmailConnection: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    service = new EmailOAuthService(prisma);
  });
  afterEach(() => {
    global.fetch = realFetch;
    process.env = { ...env };
  });

  const account = { data: [{ accountId: 12345, primaryEmailAddress: "sam@venusglobaltech.com" }] };

  describe("setup", () => {
    it("uses the data-centre-specific Zoho domains", () => {
      expect(zohoDomains("in")).toEqual({ accounts: "https://accounts.zoho.in", mail: "https://mail.zoho.in" });
      expect(zohoDomains("com").mail).toBe("https://mail.zoho.com");
      expect(zohoDomains("eu").accounts).toBe("https://accounts.zoho.eu");
      expect(zohoDomains("au").mail).toBe("https://mail.zoho.com.au");
      expect(zohoDomains("ca").accounts).toBe("https://accounts.zohocloud.ca");
      expect(zohoDomains(".IN").mail).toBe("https://mail.zoho.in");
    });

    it("is only 'configured' when the client id and secret are set", () => {
      expect(service.isConfigured("ZOHO")).toBe(true);
      delete process.env.ZOHO_CLIENT_SECRET;
      expect(service.isConfigured("ZOHO")).toBe(false);
      expect(() => service.buildAuthorizeUrl("ZOHO", "u1")).toThrow(ServiceUnavailableException);
    });

    it("builds a consent URL with offline access, send scope and the zoho redirect", () => {
      const url = new URL(service.buildAuthorizeUrl("ZOHO", "u1"));
      expect(url.origin + url.pathname).toBe("https://accounts.zoho.in/oauth/v2/auth");
      expect(url.searchParams.get("client_id")).toBe("zid");
      expect(url.searchParams.get("scope")).toBe("ZohoMail.messages.CREATE,ZohoMail.accounts.READ");
      expect(url.searchParams.get("access_type")).toBe("offline");
      expect(url.searchParams.get("redirect_uri")).toBe("https://crm.example.com/api/email-oauth/zoho/callback");
      expect(url.searchParams.get("state")).toBeTruthy();
    });

    it("maps providers and connection types both ways", () => {
      expect(connectionTypeFor("ZOHO")).toBe(EmailConnectionType.OAUTH_ZOHO);
      expect(providerFor(EmailConnectionType.OAUTH_ZOHO)).toBe("ZOHO");
      expect(providerFor(EmailConnectionType.OAUTH_GOOGLE)).toBe("GOOGLE");
      expect(providerFor(EmailConnectionType.OAUTH_MICROSOFT)).toBe("MICROSOFT");
    });

    it("reads Zoho's token lifetime whether it is in seconds or milliseconds", () => {
      expect(tokenLifetimeSeconds({ expires_in: 3600 })).toBe(3600);
      expect(tokenLifetimeSeconds({ expires_in: 3_600_000 })).toBe(3600);
      expect(tokenLifetimeSeconds({ expires_in: 3_600_000, expires_in_sec: 3600 })).toBe(3600);
    });
  });

  describe("callback", () => {
    const tokens = { access_token: "at", refresh_token: "rt", expires_in: 3600 };

    it("exchanges the code, reads the mailbox and stores an encrypted Zoho connection", async () => {
      fetchMock.mockImplementationOnce(() => json(tokens)).mockImplementationOnce(() => json(account));
      const state = generateOAuthState("user-1", "ZOHO");
      await service.handleCallback("ZOHO", "the-code", state);

      const [tokenUrl, init] = fetchMock.mock.calls[0];
      expect(tokenUrl).toBe("https://accounts.zoho.in/oauth/v2/token");
      expect((init.body as URLSearchParams).get("grant_type")).toBe("authorization_code");
      expect((init.body as URLSearchParams).get("code")).toBe("the-code");
      expect(fetchMock.mock.calls[1][0]).toBe("https://mail.zoho.in/api/accounts");
      expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Zoho-oauthtoken at");

      const saved = prisma.userEmailConnection.create.mock.calls[0][0];
      expect(saved.data).toMatchObject({
        userId: "user-1",
        connectionType: "OAUTH_ZOHO",
        providerAccountEmail: "sam@venusglobaltech.com",
        fromEmail: "sam@venusglobaltech.com",
        verified: true,
        oauthAccessToken: "at",
      });
      expect(saved.data.encryptedRefreshToken).not.toContain("rt"); // never stored in clear
    });

    it("rejects a callback whose state was made for another provider", async () => {
      await expect(service.handleCallback("ZOHO", "c", generateOAuthState("u", "GOOGLE"))).rejects.toThrow(BadRequestException);
    });

    it("fails clearly when Zoho answers 200 with an error body and no token", async () => {
      fetchMock.mockImplementationOnce(() => json({ error: "invalid_code" }));
      await expect(service.handleCallback("ZOHO", "bad", generateOAuthState("u", "ZOHO"))).rejects.toThrow(/rejected the exchange/);
      expect(prisma.userEmailConnection.create).not.toHaveBeenCalled();
    });

    it("asks for a reconnect when Zoho grants no refresh token", async () => {
      fetchMock.mockImplementationOnce(() => json({ access_token: "at", expires_in: 3600 }));
      await expect(service.handleCallback("ZOHO", "c", generateOAuthState("u", "ZOHO"))).rejects.toThrow(/offline access/);
    });
  });

  describe("sending", () => {
    it("sends as the connected account through Zoho's API with Zoho's own auth header", async () => {
      fetchMock
        .mockImplementationOnce(() => json(account))
        .mockImplementationOnce(() => json({ status: { code: 200, description: "success" }, data: { messageId: "m-1" } }));
      const res = await service.sendMail("ZOHO", "at", {
        to: "ann@acme.com",
        subject: "Hi",
        html: "<p>Hello</p>",
        from: "Venus Global Tech <hello@venusglobaltech.com>",
      });
      expect(res).toEqual({ messageId: "m-1" });
      const [url, init] = fetchMock.mock.calls[1];
      expect(url).toBe("https://mail.zoho.in/api/accounts/12345/messages");
      expect(init.headers.Authorization).toBe("Zoho-oauthtoken at");
      expect(JSON.parse(init.body)).toEqual({
        fromAddress: "sam@venusglobaltech.com", // the account's own address, not the display name
        toAddress: "ann@acme.com",
        subject: "Hi",
        content: "<p>Hello</p>",
        mailFormat: "html",
      });
    });

    it("reports Zoho's reason when it refuses the message", async () => {
      fetchMock
        .mockImplementationOnce(() => json(account))
        .mockImplementationOnce(() => json({ status: { code: 500, description: "Daily limit reached" } }, 200));
      await expect(
        service.sendMail("ZOHO", "at", { to: "a@b.com", subject: "s", html: "h", from: "x" }),
      ).rejects.toThrow(/Zoho send failed.*Daily limit reached/);
    });

    it("reports an HTTP error from Zoho", async () => {
      fetchMock
        .mockImplementationOnce(() => json(account))
        .mockImplementationOnce(() => Promise.resolve(new Response("Unauthorized", { status: 401 })));
      await expect(
        service.sendMail("ZOHO", "at", { to: "a@b.com", subject: "s", html: "h", from: "x" }),
      ).rejects.toThrow(/Zoho send failed \(401\)/);
    });
  });

  describe("token refresh", () => {
    it("refreshes an expired Zoho token against Zoho's token endpoint", async () => {
      const { encryptSecret } = await import("../../common/utils/token-crypto");
      const enc = encryptSecret("refresh-token");
      fetchMock.mockImplementationOnce(() => json({ access_token: "new-at", expires_in: 3600 }));
      const token = await service.resolveAccessToken({
        id: "c1",
        connectionType: EmailConnectionType.OAUTH_ZOHO,
        oauthAccessToken: "old",
        oauthExpiresAt: new Date(Date.now() - 1000),
        encryptedRefreshToken: enc.ciphertext,
        refreshTokenIv: enc.iv,
        refreshTokenAuthTag: enc.authTag,
      });
      expect(token).toBe("new-at");
      expect(fetchMock.mock.calls[0][0]).toBe("https://accounts.zoho.in/oauth/v2/token");
      expect((fetchMock.mock.calls[0][1].body as URLSearchParams).get("grant_type")).toBe("refresh_token");
      // Zoho doesn't rotate the refresh token, so the stored one must be left alone.
      expect(prisma.userEmailConnection.update.mock.calls[0][0].data.encryptedRefreshToken).toBeUndefined();
    });
  });
});

describe("Zoho in the rest of the system", () => {
  it("requireSendable treats a verified Zoho connection as an oauth sender", async () => {
    const mockConn = {
      verified: true,
      connectionType: "OAUTH_ZOHO",
      fromName: null,
      fromEmail: "sam@venusglobaltech.com",
      providerAccountEmail: "sam@venusglobaltech.com",
    };
    const prisma: any = {
      userEmailConnection: {
        findUnique: jest.fn().mockResolvedValue(mockConn),
        findFirst: jest.fn().mockResolvedValue(mockConn),
      },
    };
    const oauth: any = { resolveAccessToken: jest.fn().mockResolvedValue("tok") };
    const service = new EmailConnectionsService(prisma, oauth, {} as any);
    const sender = await service.requireSendable("u1");
    expect(sender).toEqual({ mode: "oauth", provider: "ZOHO", accessToken: "tok", from: "sam@venusglobaltech.com" });
  });

  it("the inbox sync only visits Gmail, Outlook, and SMTP connections (Zoho OAuth is send-only)", async () => {
    const prisma: any = { userEmailConnection: { findMany: jest.fn().mockResolvedValue([]) } };
    const engine = new EmailSyncEngineService(prisma, {} as any, {} as any);
    await engine.runOnce();
    const where = prisma.userEmailConnection.findMany.mock.calls[0][0].where;
    expect(where.connectionType.in).toEqual(["OAUTH_GOOGLE", "OAUTH_MICROSOFT", "SMTP"]);
    expect(where.connectionType.in).not.toContain("OAUTH_ZOHO");
  });
});
