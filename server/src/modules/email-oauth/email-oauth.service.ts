import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { EmailConnectionType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { encryptSecret, decryptSecret } from "../../common/utils/token-crypto";
import { generateOAuthState, verifyOAuthState } from "../../common/utils/oauth-state";

// Plain fetch against each provider's REST endpoints -- no googleapis/
// microsoft-graph-client/msal-node dependency, matching this codebase's
// existing style for third-party HTTP APIs (see common/utils/mailer.ts's
// Resend/SendGrid calls). Both Gmail and Microsoft Graph are ordinary
// REST/JSON APIs; a full SDK buys nothing here that a few fetch calls don't
// already cover, and it's one less large dependency to install/trust.

export type OAuthProvider = "GOOGLE" | "MICROSOFT" | "ZOHO";

// Zoho runs separate regional data centres, each with its own domains -- a
// token from accounts.zoho.in only works against mail.zoho.in. ZOHO_DC picks
// the one the company's Zoho account lives in (the suffix of its login URL).
const ZOHO_DC_HOST: Record<string, string> = {
  in: "zoho.in",
  com: "zoho.com",
  us: "zoho.com",
  eu: "zoho.eu",
  au: "zoho.com.au",
  jp: "zoho.jp",
  ca: "zohocloud.ca",
  sa: "zoho.sa",
};

export function zohoDomains(dc = process.env.ZOHO_DC || "in") {
  const key = dc.toLowerCase().replace(/^\./, "");
  // Unknown values are treated as a "zoho.<value>" suffix rather than rejected.
  const host = ZOHO_DC_HOST[key] ?? `zoho.${key}`;
  return { accounts: `https://accounts.${host}`, mail: `https://mail.${host}` };
}

// Zoho expects its own header scheme, not "Bearer".
const zohoAuth = (token: string) => ({ Authorization: `Zoho-oauthtoken ${token}` });

const GOOGLE_SCOPES =
  "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send";
const MICROSOFT_SCOPES = "Mail.Read Mail.Send offline_access";
// Send mail + read the account id/address. (No inbox access: Zoho connections send only.)
const ZOHO_SCOPES = "ZohoMail.messages.CREATE,ZohoMail.accounts.READ";

interface ProviderConfig {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  // Zoho also returns the lifetime in seconds under this name.
  expires_in_sec?: number;
  scope?: string;
  // Zoho answers some failures with HTTP 200 and an error body.
  error?: string;
}

// Seconds until the access token expires. Zoho has historically reported
// `expires_in` in milliseconds, so anything over a day is read as ms.
export function tokenLifetimeSeconds(tokens: Pick<TokenResponse, "expires_in" | "expires_in_sec">): number {
  const raw = tokens.expires_in_sec ?? tokens.expires_in ?? 3600;
  return raw > 86_400 ? Math.round(raw / 1000) : raw;
}

@Injectable()
export class EmailOAuthService {
  private readonly logger = new Logger(EmailOAuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Env vars are read lazily (per-request), not at module load, so the app
  // still boots fine before GOOGLE_CLIENT_ID/SECRET (etc.) are configured --
  // only actually starting a connect flow fails, with a clear message,
  // until those are set.
  isConfigured(provider: OAuthProvider): boolean {
    try {
      this.getProviderConfig(provider);
      return true;
    } catch {
      return false;
    }
  }

  private redirectBase(): string {
    return (process.env.OAUTH_REDIRECT_BASE_URL || "http://localhost:4001").replace(/\/$/, "");
  }

  private redirectUri(provider: OAuthProvider): string {
    const path = provider === "GOOGLE" ? "google" : provider === "ZOHO" ? "zoho" : "microsoft";
    return `${this.redirectBase()}/email-oauth/${path}/callback`;
  }

  private getProviderConfig(provider: OAuthProvider): ProviderConfig {
    if (provider === "GOOGLE") {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        throw new ServiceUnavailableException(
          "Google mailbox connect isn't configured yet -- GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET are not set.",
        );
      }
      return {
        clientId,
        clientSecret,
        authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        scope: GOOGLE_SCOPES,
      };
    }

    if (provider === "ZOHO") {
      const clientId = process.env.ZOHO_CLIENT_ID;
      const clientSecret = process.env.ZOHO_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        throw new ServiceUnavailableException(
          "Zoho mailbox connect isn't configured yet -- ZOHO_CLIENT_ID/ZOHO_CLIENT_SECRET are not set.",
        );
      }
      const { accounts } = zohoDomains();
      return {
        clientId,
        clientSecret,
        authorizeUrl: `${accounts}/oauth/v2/auth`,
        tokenUrl: `${accounts}/oauth/v2/token`,
        scope: ZOHO_SCOPES,
      };
    }

    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException(
        "Microsoft mailbox connect isn't configured yet -- MICROSOFT_CLIENT_ID/MICROSOFT_CLIENT_SECRET are not set.",
      );
    }
    const tenant = process.env.MICROSOFT_TENANT_ID || "common";
    return {
      clientId,
      clientSecret,
      authorizeUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
      tokenUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      scope: MICROSOFT_SCOPES,
    };
  }

  // Builds the consent-screen URL the frontend redirects the browser to.
  buildAuthorizeUrl(provider: OAuthProvider, userId: string): string {
    const config = this.getProviderConfig(provider);
    const state = generateOAuthState(userId, provider);
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: this.redirectUri(provider),
      response_type: "code",
      scope: config.scope,
      state,
      access_type: "offline",
      prompt: "consent",
    });
    // access_type/prompt are Google-only params; Microsoft's v2.0 endpoint
    // ignores unrecognized ones harmlessly, and offline_access is already in
    // its scope list instead.
    return `${config.authorizeUrl}?${params.toString()}`;
  }

  // Exchanges the authorization code for tokens, fetches the connected
  // mailbox's address, and upserts UserEmailConnection. Called from the
  // callback route (public -- see EmailOAuthController).
  async handleCallback(
    provider: OAuthProvider,
    code: string,
    state: string,
  ): Promise<{ userId: string }> {
    const payload = verifyOAuthState(state);
    if (!payload || payload.provider !== provider) {
      throw new BadRequestException(
        "This connect link is invalid or has expired -- try connecting again.",
      );
    }

    const config = this.getProviderConfig(provider);
    const tokenRes = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: this.redirectUri(provider),
      }),
    });
    if (!tokenRes.ok) {
      this.logger.error(
        `${provider} token exchange failed (${tokenRes.status}): ${await safeBody(tokenRes)}`,
      );
      throw new BadRequestException(
        "Couldn't complete the connection -- the provider rejected the exchange.",
      );
    }
    const tokens = (await tokenRes.json()) as TokenResponse;
    if (!tokens.access_token) {
      this.logger.error(`${provider} token exchange returned no token: ${tokens.error ?? "unknown error"}`);
      throw new BadRequestException(
        "Couldn't complete the connection -- the provider rejected the exchange.",
      );
    }
    if (!tokens.refresh_token) {
      // Google omits this on a re-auth unless prompt=consent forced it (we
      // always pass that); Microsoft always issues one when offline_access
      // is granted. Surfacing this clearly beats a connection that silently
      // stops working the moment the short-lived access token expires.
      throw new BadRequestException(
        "The provider didn't grant offline access -- disconnect any existing app authorization and try again.",
      );
    }

    const accountEmail = await this.fetchAccountEmail(provider, tokens.access_token);
    const encryptedRefresh = encryptSecret(tokens.refresh_token);
    const connectionType = connectionTypeFor(provider);
    const expiresAt = new Date(Date.now() + tokenLifetimeSeconds(tokens) * 1000);

    const existing = await this.prisma.userEmailConnection.findFirst({
      where: {
        userId: payload.userId,
        OR: [
          { providerAccountEmail: accountEmail },
          { fromEmail: accountEmail },
          { connectionType },
        ],
      },
    });

    const totalCount = await this.prisma.userEmailConnection.count({
      where: { userId: payload.userId },
    });
    const isDefault = existing ? existing.isDefault : totalCount === 0;

    const connectionData = {
      connectionType,
      oauthAccessToken: tokens.access_token,
      encryptedRefreshToken: encryptedRefresh.ciphertext,
      refreshTokenIv: encryptedRefresh.iv,
      refreshTokenAuthTag: encryptedRefresh.authTag,
      oauthExpiresAt: expiresAt,
      oauthScope: tokens.scope ?? config.scope,
      providerAccountEmail: accountEmail,
      fromEmail: accountEmail,
      verified: true,
      lastVerifiedAt: new Date(),
      lastError: null,
      // Switching from a previous SMTP connection -- those fields are now
      // stale for this row.
      smtpHost: null,
      smtpPort: null,
      smtpSecure: null,
      smtpUsername: null,
      encryptedPassword: null,
      passwordIv: null,
      passwordAuthTag: null,
      // A fresh connection re-syncs from scratch.
      syncCursor: null,
      lastSyncedAt: null,
    };

    if (existing) {
      await this.prisma.userEmailConnection.update({
        where: { id: existing.id },
        data: connectionData,
      });
    } else {
      await this.prisma.userEmailConnection.create({
        data: {
          userId: payload.userId,
          isDefault,
          ...connectionData,
        },
      });
    }

    return { userId: payload.userId };
  }

  // Refreshes the access token if it's near/past expiry, persists the new
  // one (and a rotated refresh token if the provider issued one), and
  // returns a token guaranteed usable right now. Called before every Gmail/
  // Graph API call.
  async resolveAccessToken(connection: {
    id: string;
    connectionType: EmailConnectionType;
    oauthAccessToken: string | null;
    encryptedRefreshToken: string | null;
    refreshTokenIv: string | null;
    refreshTokenAuthTag: string | null;
    oauthExpiresAt: Date | null;
  }): Promise<string> {
    const provider = providerFor(connection.connectionType);
    const stillValid =
      connection.oauthAccessToken &&
      connection.oauthExpiresAt &&
      connection.oauthExpiresAt.getTime() - Date.now() > 60_000; // 1 min buffer
    if (stillValid) {
      return connection.oauthAccessToken!;
    }

    if (
      !connection.encryptedRefreshToken ||
      !connection.refreshTokenIv ||
      !connection.refreshTokenAuthTag
    ) {
      throw new BadRequestException(
        "This mailbox connection is missing its refresh token -- reconnect it.",
      );
    }
    const refreshToken = decryptSecret({
      ciphertext: connection.encryptedRefreshToken,
      iv: connection.refreshTokenIv,
      authTag: connection.refreshTokenAuthTag,
    });

    const config = this.getProviderConfig(provider);
    const res = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) {
      const body = await safeBody(res);
      this.logger.error(`${provider} token refresh failed (${res.status}): ${body}`);
      await this.prisma.userEmailConnection.update({
        where: { id: connection.id },
        data: { verified: false, lastError: `Token refresh failed: ${body.slice(0, 200)}` },
      });
      throw new BadRequestException("This mailbox connection has expired -- reconnect it.");
    }
    const tokens = (await res.json()) as TokenResponse;

    const updateData: {
      oauthAccessToken: string;
      oauthExpiresAt: Date;
      encryptedRefreshToken?: string;
      refreshTokenIv?: string;
      refreshTokenAuthTag?: string;
    } = {
      oauthAccessToken: tokens.access_token,
      oauthExpiresAt: new Date(Date.now() + tokenLifetimeSeconds(tokens) * 1000),
    };
    if (!tokens.access_token) {
      throw new BadRequestException("This mailbox connection has expired -- reconnect it.");
    }
    // Google may rotate the refresh token; Microsoft always does; Zoho never does.
    if (tokens.refresh_token) {
      const encrypted = encryptSecret(tokens.refresh_token);
      updateData.encryptedRefreshToken = encrypted.ciphertext;
      updateData.refreshTokenIv = encrypted.iv;
      updateData.refreshTokenAuthTag = encrypted.authTag;
    }
    await this.prisma.userEmailConnection.update({
      where: { id: connection.id },
      data: updateData,
    });

    return tokens.access_token;
  }

  // The mailbox Zoho's API sends from: its numeric account id and primary address.
  private async fetchZohoAccount(accessToken: string): Promise<{ accountId: string; email: string }> {
    const res = await fetch(`${zohoDomains().mail}/api/accounts`, { headers: zohoAuth(accessToken) });
    if (!res.ok) {
      throw new BadRequestException("Couldn't read the connected Zoho account.");
    }
    const body = (await res.json()) as {
      data?: Array<{
        accountId?: string | number;
        primaryEmailAddress?: string;
        mailboxAddress?: string;
        emailAddress?: Array<{ mailId?: string; isPrimary?: boolean }>;
      }>;
    };
    const account = body.data?.[0];
    const email =
      account?.primaryEmailAddress ??
      account?.emailAddress?.find((a) => a.isPrimary)?.mailId ??
      account?.emailAddress?.[0]?.mailId ??
      account?.mailboxAddress;
    if (!account?.accountId || !email) {
      throw new BadRequestException("Couldn't read the connected Zoho account's address.");
    }
    return { accountId: String(account.accountId), email };
  }

  private async fetchAccountEmail(provider: OAuthProvider, accessToken: string): Promise<string> {
    if (provider === "ZOHO") {
      return (await this.fetchZohoAccount(accessToken)).email;
    }
    if (provider === "GOOGLE") {
      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok)
        throw new BadRequestException("Couldn't read the connected Gmail account's address.");
      const body = (await res.json()) as { emailAddress: string };
      return body.emailAddress;
    }

    const res = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok)
      throw new BadRequestException("Couldn't read the connected Microsoft account's address.");
    const body = (await res.json()) as { mail: string | null; userPrincipalName: string };
    return body.mail || body.userPrincipalName;
  }

  // Sends one email via Gmail's send endpoint (raw base64url MIME) or
  // Graph's sendMail endpoint -- called by EmailConnectionsService.
  // requireSendable()'s "oauth" branch consumers (the bulk-email/sequence
  // engines and DealFollowUpsService).
  async sendMail(
    provider: OAuthProvider,
    accessToken: string,
    msg: { to: string; subject: string; html: string; from: string },
  ): Promise<{ messageId?: string; threadId?: string } | void> {
    if (provider === "ZOHO") {
      const { accountId, email } = await this.fetchZohoAccount(accessToken);
      // Zoho only sends as the connected account, so the visible name from
      // `msg.from` is dropped and the account's own address is always used.
      const res = await fetch(`${zohoDomains().mail}/api/accounts/${accountId}/messages`, {
        method: "POST",
        headers: { ...zohoAuth(accessToken), "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          fromAddress: email,
          toAddress: msg.to,
          subject: msg.subject,
          content: msg.html,
          mailFormat: "html",
        }),
      });
      const text = await safeBody(res);
      let parsed: { status?: { code?: number; description?: string }; data?: { messageId?: string } } = {};
      try {
        parsed = JSON.parse(text);
      } catch {
        // not JSON -- fall through to the generic error below
      }
      if (!res.ok || (parsed.status?.code !== undefined && parsed.status.code !== 200)) {
        throw new Error(
          `Zoho send failed (${res.status}): ${parsed.status?.description ?? text}`,
        );
      }
      return { messageId: parsed.data?.messageId };
    }

    if (provider === "GOOGLE") {
      const mime = [
        `From: ${msg.from}`,
        `To: ${msg.to}`,
        `Subject: ${msg.subject}`,
        "MIME-Version: 1.0",
        "Content-Type: text/html; charset=utf-8",
        "",
        msg.html,
      ].join("\r\n");
      const raw = Buffer.from(mime).toString("base64url");
      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ raw }),
      });
      if (!res.ok) {
        throw new Error(`Gmail send failed (${res.status}): ${await safeBody(res)}`);
      }
      const data = (await res.json()) as { id?: string; threadId?: string };
      return { messageId: data.id, threadId: data.threadId };
    }

    // Graph's one-shot /me/sendMail returns 202 with an empty body, so it
    // can't hand back a message id/conversationId the way Gmail's send
    // endpoint does. Create the message as a draft first (its response
    // carries id + conversationId), then send that draft -- same net effect
    // (one sent email) but with an id we can persist for reply-linking, so
    // Outlook-connected mailboxes get EMAIL_REPLIED detection too.
    const draftRes = await fetch("https://graph.microsoft.com/v1.0/me/messages", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: msg.subject,
        body: { contentType: "HTML", content: msg.html },
        toRecipients: [{ emailAddress: { address: msg.to } }],
      }),
    });
    if (!draftRes.ok) {
      throw new Error(`Graph draft create failed (${draftRes.status}): ${await safeBody(draftRes)}`);
    }
    const draft = (await draftRes.json()) as { id: string; conversationId?: string };

    const sendRes = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${draft.id}/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!sendRes.ok) {
      throw new Error(`Graph sendMail failed (${sendRes.status}): ${await safeBody(sendRes)}`);
    }
    return { messageId: draft.id, threadId: draft.conversationId };
  }
}

export function connectionTypeFor(provider: OAuthProvider): EmailConnectionType {
  if (provider === "GOOGLE") return EmailConnectionType.OAUTH_GOOGLE;
  if (provider === "ZOHO") return EmailConnectionType.OAUTH_ZOHO;
  return EmailConnectionType.OAUTH_MICROSOFT;
}

export function providerFor(type: EmailConnectionType): OAuthProvider {
  if (type === EmailConnectionType.OAUTH_GOOGLE) return "GOOGLE";
  if (type === EmailConnectionType.OAUTH_ZOHO) return "ZOHO";
  return "MICROSOFT";
}

async function safeBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return res.statusText;
  }
}
