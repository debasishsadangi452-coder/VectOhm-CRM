import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import * as nodemailer from "nodemailer";
import { createConnection, isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { EmailConnectionType, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ConnectEmailDto } from "./dto/connect-email.dto";
import { encryptSecret, decryptSecret } from "../../common/utils/token-crypto";
import { hasHttpMailProvider } from "../../common/utils/mailer";
import { canUseSalesOrRecruitment } from "../../common/utils/sales-access";
import { EmailOAuthService, providerFor, type OAuthProvider } from "../email-oauth/email-oauth.service";
import { EmailSyncEngineService } from "../email-oauth/email-sync-engine.service";
import type { RequestUser } from "../../common/types/request-user.type";

export type SendableSender =
  | { mode: "smtp"; transporter: nodemailer.Transporter; from: string }
  | { mode: "http"; replyTo: string }
  | { mode: "oauth"; provider: OAuthProvider; accessToken: string; from: string };

export interface NetworkDiagnosticResult {
  label: string;
  host: string;
  port: number;
  ok: boolean;
  ms: number;
  error?: string;
}

// Fixed, hardcoded targets only (the same providers PROVIDER_PRESETS on the
// frontend offers) -- never a user-supplied host/port, so this can't be used
// as an arbitrary internal-network port probe.
const DIAGNOSTIC_TARGETS: Array<{ label: string; host: string; port: number }> = [
  { label: "Zoho India (465, TLS)", host: "smtp.zoho.in", port: 465 },
  { label: "Zoho US (465, TLS)", host: "smtp.zoho.com", port: 465 },
  { label: "Zoho (587, STARTTLS)", host: "smtp.zoho.in", port: 587 },
  { label: "Gmail (465, TLS)", host: "smtp.gmail.com", port: 465 },
  { label: "Outlook (587, STARTTLS)", host: "smtp.office365.com", port: 587 },
];

export interface EmailAccountSummary {
  id: string;
  connectionType: EmailConnectionType;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean | null;
  smtpUsername: string | null;
  providerAccountEmail: string | null;
  fromName: string | null;
  fromEmail: string | null;
  verified: boolean;
  lastVerifiedAt: Date | null;
  lastError: string | null;
  isDefault: boolean;
  label: string | null;
}

export interface EmailConnectionStatus {
  connected: boolean;
  connectionType: EmailConnectionType | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean | null;
  smtpUsername: string | null;
  providerAccountEmail: string | null;
  fromName: string | null;
  fromEmail: string | null;
  verified: boolean;
  lastVerifiedAt: Date | null;
  lastError: string | null;
  // Whether the shared HTTP stopgap sender (see requireSendable) is
  // available, so the frontend can explain that sending will still work
  // (via a shared address with Reply-To set to the user) even without a
  // verified SMTP connection.
  httpFallbackAvailable: boolean;
  connections: EmailAccountSummary[];
  activeConnectionId: string | null;
}

const NOT_CONNECTED: Omit<EmailConnectionStatus, "httpFallbackAvailable"> = {
  connected: false,
  connectionType: null,
  smtpHost: null,
  smtpPort: null,
  smtpSecure: null,
  smtpUsername: null,
  providerAccountEmail: null,
  fromName: null,
  fromEmail: null,
  verified: false,
  lastVerifiedAt: null,
  lastError: null,
  connections: [],
  activeConnectionId: null,
};

// Certificate checking stays on unless an operator explicitly opts out (e.g. a
// mail relay with a self-signed cert) -- otherwise anyone on the network path
// could read the SMTP password.
function allowInsecureTls(): boolean {
  return process.env.SMTP_ALLOW_INSECURE_TLS === "true";
}

export function isPrivateAddress(address: string): boolean {
  const a = address.toLowerCase().replace(/^::ffff:/, "");
  if (a === "::1" || a === "::" || a.startsWith("fe80:") || a.startsWith("fc") || a.startsWith("fd")) {
    return true;
  }
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(a);
  if (!m) return false;
  const [x, y] = [Number(m[1]), Number(m[2])];
  return (
    x === 0 ||
    x === 10 ||
    x === 127 ||
    (x === 169 && y === 254) ||
    (x === 172 && y >= 16 && y <= 31) ||
    (x === 192 && y === 168) ||
    (x === 100 && y >= 64 && y <= 127) ||
    x >= 224
  );
}

@Injectable()
export class EmailConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailOAuth: EmailOAuthService,
    @Optional() private readonly syncEngine?: EmailSyncEngineService,
  ) {}

  async getStatus(user: RequestUser): Promise<EmailConnectionStatus> {
    this.assertCanUse(user);
    let conns = await this.prisma.userEmailConnection.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    });
    if (conns.length === 0 && (user.role.name === RoleName.ADMIN || user.role.name === RoleName.MANAGER)) {
      conns = await this.prisma.userEmailConnection.findMany({
        where: { verified: true },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      });
    }
    const httpFallbackAvailable = hasHttpMailProvider();
    if (conns.length === 0) {
      return { ...NOT_CONNECTED, connections: [], activeConnectionId: null, httpFallbackAvailable };
    }
    const active = conns.find((c) => c.isDefault) ?? conns[0];
    const summaries: EmailAccountSummary[] = conns.map((c) => ({
      id: c.id,
      connectionType: c.connectionType,
      smtpHost: c.smtpHost,
      smtpPort: c.smtpPort,
      smtpSecure: c.smtpSecure,
      smtpUsername: c.smtpUsername,
      providerAccountEmail: c.providerAccountEmail,
      fromName: c.fromName,
      fromEmail: c.fromEmail,
      verified: c.verified,
      lastVerifiedAt: c.lastVerifiedAt,
      lastError: c.lastError,
      isDefault: c.id === active.id,
      label: c.label,
    }));
    return {
      connected: true,
      connectionType: active.connectionType,
      smtpHost: active.smtpHost,
      smtpPort: active.smtpPort,
      smtpSecure: active.smtpSecure,
      smtpUsername: active.smtpUsername,
      providerAccountEmail: active.providerAccountEmail,
      fromName: active.fromName,
      fromEmail: active.fromEmail,
      verified: active.verified,
      lastVerifiedAt: active.lastVerifiedAt,
      lastError: active.lastError,
      httpFallbackAvailable,
      connections: summaries,
      activeConnectionId: active.id,
    };
  }

  // Verifies the SMTP credentials actually work (a real connection + auth
  // handshake, not just "looks well-formed") before ever persisting them --
  // a bad password saved as "connected" would silently fail every send
  // later instead of failing loudly here, once, with an actionable message.
  // SMTP-only -- an OAuth connection is set up via EmailOAuthService's
  // authorize/callback flow instead, not this endpoint.
  async connect(user: RequestUser, dto: ConnectEmailDto): Promise<EmailConnectionStatus> {
    this.assertCanUse(user);

    let existing: any = null;
    if (dto.connectionId) {
      existing = await this.prisma.userEmailConnection.findFirst({
        where: { id: dto.connectionId, userId: user.id },
      });
      if (!existing && (user.role.name === RoleName.ADMIN || user.role.name === RoleName.MANAGER)) {
        existing = await this.prisma.userEmailConnection.findFirst({
          where: { id: dto.connectionId },
        });
      }
      if (!existing) {
        throw new NotFoundException("Connection to update not found");
      }
    } else {
      existing = await this.prisma.userEmailConnection.findFirst({
        where: {
          userId: user.id,
          OR: [
            { fromEmail: dto.fromEmail.trim() },
            { smtpUsername: dto.smtpUsername.trim() },
          ],
        },
      });
    }

    let password = dto.smtpPassword;
    if (!password) {
      if (!existing?.encryptedPassword || !existing.passwordIv || !existing.passwordAuthTag) {
        throw new BadRequestException("Password is required for a new connection");
      }
      password = decryptSecret({
        ciphertext: existing.encryptedPassword,
        iv: existing.passwordIv,
        authTag: existing.passwordAuthTag,
      });
    }

    const result = await this.verifyCredentials({
      host: dto.smtpHost,
      port: dto.smtpPort,
      secure: dto.smtpSecure,
      username: dto.smtpUsername,
      password,
    });
    if (!result.ok) {
      throw new BadRequestException(`Couldn't connect to that mail server: ${result.error}`);
    }

    const targetUserId = existing ? existing.userId : user.id;
    const count = await this.prisma.userEmailConnection.count({ where: { userId: targetUserId } });
    const shouldBeDefault = dto.setAsDefault ?? (existing ? existing.isDefault : count === 0);

    const encrypted = encryptSecret(password);
    const data = {
      connectionType: EmailConnectionType.SMTP,
      smtpHost: dto.smtpHost,
      smtpPort: dto.smtpPort,
      smtpSecure: dto.smtpSecure,
      smtpUsername: dto.smtpUsername,
      encryptedPassword: encrypted.ciphertext,
      passwordIv: encrypted.iv,
      passwordAuthTag: encrypted.authTag,
      fromName: dto.fromName,
      fromEmail: dto.fromEmail,
      label: dto.label ?? existing?.label ?? null,
      verified: true,
      lastVerifiedAt: new Date(),
      lastError: null,
      // Switching from a previous OAuth connection -- those fields are now
      // stale for this row.
      oauthAccessToken: null,
      encryptedRefreshToken: null,
      refreshTokenIv: null,
      refreshTokenAuthTag: null,
      oauthExpiresAt: null,
      oauthScope: null,
      providerAccountEmail: null,
      syncCursor: null,
      lastSyncedAt: null,
    };

    if (shouldBeDefault) {
      await this.prisma.userEmailConnection.updateMany({
        where: { userId: targetUserId },
        data: { isDefault: false },
      });
    }

    let conn;
    if (existing) {
      conn = await this.prisma.userEmailConnection.update({
        where: { id: existing.id },
        data: {
          ...data,
          isDefault: shouldBeDefault,
        },
      });
    } else {
      conn = await this.prisma.userEmailConnection.create({
        data: {
          userId: targetUserId,
          isDefault: shouldBeDefault,
          ...data,
        },
      });
    }

    this.syncEngine?.syncConnection(conn).catch(() => {});
    return this.getStatus(user);
  }

  async setDefaultConnection(user: RequestUser, connectionId: string): Promise<EmailConnectionStatus> {
    this.assertCanUse(user);
    let conn = await this.prisma.userEmailConnection.findFirst({
      where: { id: connectionId, userId: user.id },
    });
    if (!conn && (user.role.name === RoleName.ADMIN || user.role.name === RoleName.MANAGER)) {
      conn = await this.prisma.userEmailConnection.findFirst({
        where: { id: connectionId },
      });
    }
    if (!conn) {
      throw new NotFoundException("Email connection not found");
    }
    const targetUserId = conn.userId;
    await this.prisma.$transaction([
      this.prisma.userEmailConnection.updateMany({
        where: { userId: targetUserId },
        data: { isDefault: false },
      }),
      this.prisma.userEmailConnection.update({
        where: { id: connectionId },
        data: { isDefault: true },
      }),
    ]);
    return this.getStatus(user);
  }

  // Re-checks a previously-saved SMTP connection without needing the
  // password re-entered -- decrypts what's on file and re-runs the same
  // handshake. OAuth connections re-verify implicitly every send via
  // resolveAccessToken()'s refresh, so there's nothing separate to "test"
  // here for those.
  async test(user: RequestUser, connectionId?: string): Promise<EmailConnectionStatus> {
    this.assertCanUse(user);
    let conn: any = null;
    if (connectionId) {
      conn = await this.prisma.userEmailConnection.findFirst({
        where: { id: connectionId, userId: user.id },
      });
      if (!conn && (user.role.name === RoleName.ADMIN || user.role.name === RoleName.MANAGER)) {
        conn = await this.prisma.userEmailConnection.findFirst({
          where: { id: connectionId },
        });
      }
    } else {
      conn = await this.prisma.userEmailConnection.findFirst({
        where: { userId: user.id },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      });
      if (!conn && (user.role.name === RoleName.ADMIN || user.role.name === RoleName.MANAGER)) {
        conn = await this.prisma.userEmailConnection.findFirst({
          where: { verified: true },
          orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
        });
      }
    }
    if (!conn) {
      throw new NotFoundException("No email connection on file yet -- connect one first.");
    }
    if (conn.connectionType !== EmailConnectionType.SMTP) {
      return this.getStatus(user);
    }
    if (
      !conn.encryptedPassword ||
      !conn.passwordIv ||
      !conn.passwordAuthTag ||
      !conn.smtpHost ||
      !conn.smtpPort
    ) {
      throw new BadRequestException(
        "This connection is missing its SMTP credentials -- reconnect it.",
      );
    }
    const password = decryptSecret({
      ciphertext: conn.encryptedPassword,
      iv: conn.passwordIv,
      authTag: conn.passwordAuthTag,
    });
    const result = await this.verifyCredentials({
      host: conn.smtpHost,
      port: conn.smtpPort,
      secure: conn.smtpSecure ?? true,
      username: conn.smtpUsername ?? "",
      password,
    });

    await this.prisma.userEmailConnection.update({
      where: { id: conn.id },
      data: {
        verified: result.ok,
        lastVerifiedAt: result.ok ? new Date() : conn.lastVerifiedAt,
        lastError: result.ok ? null : result.error,
      },
    });
    return this.getStatus(user);
  }

  async disconnect(user: RequestUser, connectionId?: string): Promise<void> {
    this.assertCanUse(user);
    if (connectionId) {
      let target = await this.prisma.userEmailConnection.findFirst({
        where: { id: connectionId, userId: user.id },
      });
      if (!target && (user.role.name === RoleName.ADMIN || user.role.name === RoleName.MANAGER)) {
        target = await this.prisma.userEmailConnection.findFirst({
          where: { id: connectionId },
        });
      }
      if (target) {
        await this.prisma.userEmailConnection.delete({ where: { id: target.id } });
        if (target.isDefault) {
          const next = await this.prisma.userEmailConnection.findFirst({
            where: { userId: target.userId },
            orderBy: { updatedAt: "desc" },
          });
          if (next) {
            await this.prisma.userEmailConnection.update({
              where: { id: next.id },
              data: { isDefault: true },
            });
          }
        }
      }
    } else {
      await this.prisma.userEmailConnection.deleteMany({ where: { userId: user.id } });
    }
  }

  // Used by the bulk-email/sequence send engines and DealFollowUpsService to
  // resolve how to send for whichever user owns the thing being processed.
  // Prefers the user's own connected mailbox (SMTP or OAuth -- recipients
  // see and can reply to them directly). Falls back to the shared HTTP
  // provider (Resend/SendGrid, see common/utils/mailer.ts) with Reply-To set
  // to the sender's real CRM account email when no mailbox is connected --
  // a stopgap for hosts that block raw SMTP egress entirely (this one
  // currently does; see the "Test server network" diagnostic on the Bulk
  // Email Sender page). Throws rather than returning null/undefined so
  // callers can't accidentally treat "nothing configured" as "nothing to
  // send" -- it should always surface as a visible failure.
  async requireSendable(userId: string, connectionId?: string | null): Promise<SendableSender> {
    let conn: any = null;
    if (connectionId) {
      conn = await this.prisma.userEmailConnection.findFirst({
        where: { id: connectionId, userId },
      });
    }
    if (!conn) {
      conn = await this.prisma.userEmailConnection.findFirst({
        where: { userId, isDefault: true, verified: true },
      });
    }
    if (!conn) {
      conn = await this.prisma.userEmailConnection.findFirst({
        where: { userId, verified: true },
        orderBy: { updatedAt: "desc" },
      });
    }
    if (!conn) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { role: true },
      });
      if (user?.role?.name === RoleName.ADMIN || user?.role?.name === RoleName.MANAGER) {
        conn = await this.prisma.userEmailConnection.findFirst({
          where: { verified: true },
          orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
        });
      }
    }
    if (!conn) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { role: true },
      });
      if (user?.role?.name === RoleName.ADMIN || user?.role?.name === RoleName.MANAGER) {
        conn = await this.prisma.userEmailConnection.findFirst({
          where: { verified: true },
          orderBy: { updatedAt: "desc" },
        });
      }
    }

    if (conn?.verified && conn.connectionType === EmailConnectionType.SMTP) {
      if (
        !conn.encryptedPassword ||
        !conn.passwordIv ||
        !conn.passwordAuthTag ||
        !conn.smtpHost ||
        !conn.smtpPort
      ) {
        throw new BadRequestException(
          "Sender's SMTP connection is missing credentials -- reconnect it.",
        );
      }
      const password = decryptSecret({
        ciphertext: conn.encryptedPassword,
        iv: conn.passwordIv,
        authTag: conn.passwordAuthTag,
      });
      const smtpOptions: any = {
        host: conn.smtpHost,
        port: conn.smtpPort,
        secure: conn.smtpSecure ?? true,
        family: 4,
        auth: { user: conn.smtpUsername ?? undefined, pass: password },
        connectionTimeout: 15_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
        tls: { rejectUnauthorized: allowInsecureTls() === false },
      };
      const transporter = (nodemailer.createTransport as any)(smtpOptions);
      const from =
        conn.fromName && conn.fromEmail
          ? `${conn.fromName} <${conn.fromEmail}>`
          : (conn.fromEmail ?? conn.smtpUsername ?? "");
      return { mode: "smtp", transporter, from };
    }

    if (
      conn?.verified &&
      (conn.connectionType === EmailConnectionType.OAUTH_GOOGLE ||
        conn.connectionType === EmailConnectionType.OAUTH_MICROSOFT ||
        conn.connectionType === EmailConnectionType.OAUTH_ZOHO)
    ) {
      const provider: OAuthProvider =
        providerFor(conn.connectionType);
      const accessToken = await this.emailOAuth.resolveAccessToken(conn);
      const from =
        conn.fromName && conn.fromEmail
          ? `${conn.fromName} <${conn.fromEmail}>`
          : (conn.fromEmail ?? conn.providerAccountEmail ?? "");
      return { mode: "oauth", provider, accessToken, from };
    }

    if (hasHttpMailProvider()) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (!user) {
        throw new BadRequestException("Sender not found");
      }
      return { mode: "http", replyTo: user.email };
    }

    throw new BadRequestException("Sender has not connected a verified email account");
  }

  // Used by BulkEmailService/SequencesService's create/enroll pre-checks --
  // lets a campaign be created or contacts be enrolled even before a user
  // has (or, right now, even could) connect SMTP, as long as the shared HTTP
  // stopgap is configured. See requireSendable above for the send-time
  // counterpart.
  hasHttpFallback(): boolean {
    return hasHttpMailProvider();
  }

  // Raw TCP connect only -- no auth, no TLS handshake -- so it isolates
  // "can this server even reach the mail host on this port" from "did the
  // credentials/TLS negotiation work". Distinguishes a network-level block
  // (this server's host blocking egress, or the mail provider silently
  // dropping connections from a datacenter IP) from an account-level one
  // (bad credentials, SMTP access disabled) when a Connect/Test attempt
  // times out and it isn't obvious which side is at fault.
  async networkDiagnostic(user: RequestUser): Promise<NetworkDiagnosticResult[]> {
    this.assertCanUse(user);
    return Promise.all(DIAGNOSTIC_TARGETS.map((target) => this.probeTcp(target)));
  }

  private probeTcp(target: {
    label: string;
    host: string;
    port: number;
  }): Promise<NetworkDiagnosticResult> {
    return new Promise((resolve) => {
      const start = Date.now();
      const socket = createConnection({
        host: target.host,
        port: target.port,
        family: 4,
        timeout: 8_000,
      });
      const finish = (ok: boolean, error?: string) => {
        socket.destroy();
        resolve({ ...target, ok, ms: Date.now() - start, error });
      };
      socket.once("connect", () => finish(true));
      socket.once("timeout", () => finish(false, "Timed out"));
      socket.once("error", (err) =>
        finish(false, err instanceof Error ? err.message : String(err)),
      );
    });
  }

  // The host is user-supplied, so without this "connect" doubles as a port
  // scanner for the server's own network (loopback, cloud metadata, private
  // ranges), with the error text returned to the caller.
  private async assertPublicHost(host: string): Promise<void> {
    const addresses = isIP(host)
      ? [{ address: host }]
      : await lookup(host, { all: true }).catch(() => {
          throw new BadRequestException("That mail server hostname could not be resolved");
        });
    for (const { address } of addresses) {
      if (isPrivateAddress(address)) {
        throw new BadRequestException("That mail server address is not allowed");
      }
    }
  }

  private async verifyCredentials(opts: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
  }): Promise<{ ok: true } | { ok: false; error: string }> {
    await this.assertPublicHost(opts.host);
    const smtpOptions: any = {
      host: opts.host,
      port: opts.port,
      secure: opts.secure,
      family: 4,
      auth: { user: opts.username, pass: opts.password },
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      tls: { rejectUnauthorized: allowInsecureTls() === false },
    };
    const transporter = (nodemailer.createTransport as any)(smtpOptions);
    try {
      await transporter.verify();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    } finally {
      transporter.close();
    }
  }

  private assertCanUse(user: RequestUser) {
    if (!canUseSalesOrRecruitment(user)) {
      throw new ForbiddenException("Email connections are only available to Sales and Recruitment departments");
    }
  }
}
