import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AuthEventType, RoleName } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../common/types/request-user.type";
import { parseTtlMs } from "../../common/utils/parse-ttl";
import { toRequestUser } from "../../common/utils/to-request-user";
import { sendEmail } from "../../common/utils/mailer";
import { CURRENT_TERMS_VERSION, TERMS_TEXT } from "./terms";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const LOGIN_EVENT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
// Brute-force protection: 3 wrong passwords in this rolling window locks the
// account out for the rest of the window, regardless of whether a later
// attempt happens to be correct. Short and rolling (not "until next business
// day") on purpose -- a day-long lockout triggered by wrong guesses would let
// anyone who knows a coworker's email address lock them out for a whole
// workday with zero verification.
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_LOGIN_ATTEMPTS = 3;

// Emails are stored lowercase everywhere in this app (seed.ts, user
// creation), but a Postgres exact match is case-sensitive -- normalize any
// incoming email the same way before comparing against a stored row.
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

// Folded into login()/refresh() responses (rather than a separate endpoint)
// so there's no extra round trip and no race between "logged in" and "terms
// fetched" -- see terms.ts and the desktop agent's applyAuthResult, which
// gates its monitoring loops on termsAccepted.
export interface TermsStatus {
  termsAccepted: boolean;
  termsVersion: string;
  termsText: string;
}

// Best-effort request metadata attached to a login/logout audit event.
export interface AuthEventContext {
  ipAddress?: string | null;
  userAgent?: string | null;
  timezoneOffset?: number | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async validateCredentials(
    email: string,
    password: string,
    context: AuthEventContext = {},
  ): Promise<RequestUser> {
    // Emails are stored lowercase (see seed.ts / user creation) but a
    // Postgres exact match is case-sensitive -- without this, "Jon@..."
    // fails to match a stored "jon@..." row and silently looks like a wrong
    // password instead of a case mismatch.
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
      include: { role: true, department: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // ADMIN is exempt so someone else mistyping an admin's password can't
    // lock that admin out of critical operations.
    if (user.role.name !== RoleName.ADMIN) {
      const recentFailures = await this.prisma.loginEvent.count({
        where: {
          userId: user.id,
          type: AuthEventType.LOGIN_FAILED,
          createdAt: { gte: new Date(Date.now() - LOGIN_LOCKOUT_MS) },
        },
      });
      if (recentFailures >= MAX_FAILED_LOGIN_ATTEMPTS) {
        throw new ForbiddenException(
          "Too many incorrect password attempts. Try again in 15 minutes.",
        );
      }
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      await this.recordAuthEvent(user.id, AuthEventType.LOGIN_FAILED, context);
      throw new UnauthorizedException("Invalid credentials");
    }

    return toRequestUser(user);
  }

  private signAccessToken(user: RequestUser): string {
    return this.jwt.sign(
      { sub: user.id, email: user.email, role: user.role.name },
      {
        secret: this.config.get<string>("JWT_ACCESS_SECRET"),
        expiresIn: this.config.get<string>("JWT_ACCESS_TTL", "15m"),
      },
    );
  }

  private async issueRefreshToken(
    userId: string,
  ): Promise<{ id: string | undefined; raw: string; expiresAt: Date }> {
    const raw = randomBytes(64).toString("hex");
    const tokenHash = createHash("sha256").update(raw).digest("hex");
    // Default to 10 years (effectively permanent until user explicitly logs out)
    const ttlMs = parseTtlMs(this.config.get<string>("JWT_REFRESH_TTL", "3650d"));
    const expiresAt = new Date(Date.now() + ttlMs);

    const created = await this.prisma.refreshToken.create({
      data: { tokenHash, userId, expiresAt },
    });

    return { id: created?.id, raw, expiresAt };
  }

  async login(
    email: string,
    password: string,
    context: AuthEventContext = {},
  ): Promise<{ user: RequestUser } & AuthTokens & TermsStatus> {
    const user = await this.validateCredentials(email, password, context);

    const accessToken = this.signAccessToken(user);
    const { raw, expiresAt } = await this.issueRefreshToken(user.id);

    await this.recordAuthEvent(user.id, AuthEventType.LOGIN, context);

    const termsStatus = await this.getTermsStatus(user.id);
    return {
      user,
      accessToken,
      refreshToken: raw,
      refreshTokenExpiresAt: expiresAt,
      ...termsStatus,
    };
  }

  // Whether this user's most recent acceptance (if any) matches the current
  // version -- bumping CURRENT_TERMS_VERSION re-gates everyone, even
  // employees who accepted an older wording, on their next login/refresh.
  private async getTermsStatus(userId: string): Promise<TermsStatus> {
    const latest = await this.prisma.termsAcceptance.findFirst({
      where: { userId },
      orderBy: { acceptedAt: "desc" },
      select: { version: true },
    });
    return {
      termsAccepted: latest?.version === CURRENT_TERMS_VERSION,
      termsVersion: CURRENT_TERMS_VERSION,
      termsText: TERMS_TEXT,
    };
  }

  // Records an employee's explicit acceptance of the desktop agent's
  // monitoring notice -- see terms.ts. Rejects a stale version so a client
  // can never accept-on-behalf-of a wording it wasn't actually shown (e.g. a
  // cached response from before a version bump).
  async acceptTerms(
    userId: string,
    version: string,
    context: AuthEventContext = {},
  ): Promise<void> {
    if (version !== CURRENT_TERMS_VERSION) {
      throw new BadRequestException(
        "This notice has been updated. Please review the current version.",
      );
    }
    await this.prisma.termsAcceptance.create({
      data: {
        userId,
        version,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      },
    });
  }

  // Fire-and-forget audit record; a logging failure must never block sign-in or
  // sign-out, so failures are swallowed (the event is best-effort).
  private async recordAuthEvent(userId: string, type: AuthEventType, context: AuthEventContext) {
    try {
      await this.prisma.loginEvent.create({
        data: {
          userId,
          type,
          ipAddress: context.ipAddress ?? null,
          userAgent: context.userAgent ?? null,
        },
      });
      // Opportunistic retention: occasionally purge events past the 90-day
      // window. Runs on a fraction of writes (not every one) so it costs almost
      // nothing, and the delete is bounded by the createdAt index.
      if (Math.random() < 0.05) {
        await this.prisma.loginEvent.deleteMany({
          where: { createdAt: { lt: new Date(Date.now() - LOGIN_EVENT_RETENTION_MS) } },
        });
      }
    } catch {
      // ignore -- auditing is non-critical to the auth flow
    }
  }

  async refresh(rawToken: string): Promise<{ user: RequestUser } & AuthTokens & TermsStatus> {
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { role: true, department: true } } },
    });

    if (!existing || !existing.user.isActive) {
      throw new UnauthorizedException("Invalid refresh token or account deactivated");
    }

    if (existing.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("Expired refresh token");
    }

    // Grace window for rotated tokens: if a token was rotated recently (within 24 hours),
    // allow refreshing so that concurrent requests from the desktop agent background loop
    // and the embedded CRM webview do not trigger spurious 401s and log the user out.
    const ROTATION_GRACE_WINDOW_MS = 24 * 60 * 60 * 1000;
    let relinkLostReplacement = false;
    if (existing.revokedAt) {
      const msSinceRevocation = Date.now() - existing.revokedAt.getTime();
      if (
        msSinceRevocation > ROTATION_GRACE_WINDOW_MS &&
        !(await this.replacementWasNeverUsed(existing.replacedById))
      ) {
        throw new UnauthorizedException("Invalid or revoked refresh token");
      }
      relinkLostReplacement = msSinceRevocation > ROTATION_GRACE_WINDOW_MS;
    }

    const user: RequestUser = toRequestUser(existing.user);

    const accessToken = this.signAccessToken(user);
    const { id: newTokenId, raw, expiresAt } = await this.issueRefreshToken(user.id);

    if (!existing.revokedAt) {
      // Rotate: mark the presented token as rotated and remember what replaced it.
      await this.prisma.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date(), replacedById: newTokenId ?? null },
      });
    } else if (relinkLostReplacement) {
      // Recovered from a lost rotation (see replacementWasNeverUsed): point at
      // the token this client is actually about to receive, so once it is used
      // the old one stops working again.
      await this.prisma.refreshToken.update({
        where: { id: existing.id },
        data: { replacedById: newTokenId ?? null },
      });
    }

    const termsStatus = await this.getTermsStatus(user.id);
    return {
      user,
      accessToken,
      refreshToken: raw,
      refreshTokenExpiresAt: expiresAt,
      ...termsStatus,
    };
  }

  // A rotated token past its grace window is normally dead. The exception: its
  // replacement still exists and has never been presented. That means the
  // client never received it -- the refresh reply was lost because the laptop
  // went to sleep or the network dropped mid-request -- so the client is still
  // legitimately holding the old token. This is what used to sign the desktop
  // agent out on its own after a night or weekend away. A replacement that was
  // used (or deleted by logout / password reset) keeps the old token rejected.
  private async replacementWasNeverUsed(replacedById: string | null): Promise<boolean> {
    if (!replacedById) return false;
    const replacement = await this.prisma.refreshToken.findUnique({
      where: { id: replacedById },
      select: { revokedAt: true, expiresAt: true },
    });
    return !!replacement && !replacement.revokedAt && replacement.expiresAt.getTime() > Date.now();
  }

  async logout(rawToken: string, context: AuthEventContext = {}): Promise<void> {
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    // Resolve the owning user before revoking so we can attribute the LOGOUT
    // audit event.
    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { userId: true, user: { select: { canSignOut: true, role: { select: { name: true } } } } },
    });

    // Screen recording only runs while someone is signed in, so a normal user
    // can't sign out until an Admin grants it (User.canSignOut). Admins always
    // can. The session is left untouched on refusal.
    const owner = token?.user;
    if (owner && owner.role.name !== RoleName.ADMIN && !owner.canSignOut) {
      throw new ForbiddenException(
        "Signing out is disabled for your account. Ask an admin if you need to sign out.",
      );
    }

    // End only the session that asked to sign out. Deleting every token the
    // user has meant signing out of one browser tab also killed the desktop
    // agent (stopping monitoring mid-shift) and every other device, at random
    // later moments when each one next tried to refresh. "Sign out everywhere"
    // is what a password reset does (see resetPassword below).
    await this.prisma.refreshToken.deleteMany({
      where: { tokenHash },
    });
    if (token) {
      await this.recordAuthEvent(token.userId, AuthEventType.LOGOUT, context);
    }
  }

  // Always resolves the same way regardless of whether the email exists, so
  // the endpoint can't be used to enumerate accounts. If the user exists and
  // is active, a single-use, 1-hour reset token is created and emailed.
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
    if (!user || !user.isActive) {
      return;
    }

    const raw = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(raw).digest("hex");
    await this.prisma.passwordResetToken.create({
      data: { tokenHash, userId: user.id, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
    });

    const appUrl =
      this.config.get<string>("APP_URL") ??
      this.config.get<string>("CORS_ORIGIN") ??
      "http://localhost:8080";
    const resetUrl = `${appUrl.replace(/\/$/, "")}/reset-password?token=${raw}`;

    // A delivery failure must look identical to "no such account" -- surfacing
    // it as an error would reveal which emails are registered.
    try {
      await sendEmail({
        to: user.email,
        subject: "Reset your Venus CRM password",
        html: `<p>Hi ${user.firstName},</p>
<p>We received a request to reset your Venus CRM password. Click the link below to choose a new one. This link expires in 1 hour and can be used once.</p>
<p><a href="${resetUrl}">Reset my password</a></p>
<p>If you didn't request this, you can safely ignore this email.</p>`,
        text: `Reset your Venus CRM password: ${resetUrl} (expires in 1 hour)`,
      });
    } catch (err) {
      console.error("Failed to send password reset email:", err);
    }
  }

  // Validates the single-use token, sets the new password, consumes the token,
  // and revokes every existing refresh session (forces re-login everywhere).
  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException(
        "This reset link is invalid or has expired. Request a new one.",
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // Delete outright rather than mark revokedAt: refresh()'s rotation grace
      // window treats any revoked-but-recent token as still usable, which
      // would let a token stolen before this reset keep working for the
      // length of that window. Deleting removes it immediately and for good.
      this.prisma.refreshToken.deleteMany({
        where: { userId: record.userId },
      }),
    ]);
  }
}
