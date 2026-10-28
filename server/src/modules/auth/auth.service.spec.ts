import { ForbiddenException, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { AuthEventType, RoleName } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { AuthService } from "./auth.service";
import { sendEmail } from "../../common/utils/mailer";
import { CURRENT_TERMS_VERSION, TERMS_TEXT } from "./terms";

jest.mock("bcryptjs");
jest.mock("../../common/utils/mailer", () => ({
  sendEmail: jest.fn().mockResolvedValue({ delivered: true, provider: "test" }),
}));

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockedSendEmail = sendEmail as jest.Mock;

function buildPrismaMock() {
  return {
    user: { findUnique: jest.fn(), update: jest.fn() },
    loginEvent: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn(),
    },
    refreshToken: {
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    passwordResetToken: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    termsAcceptance: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
    $transaction: jest.fn(),
  };
}

function buildActiveUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "user-1",
    email: "jon@venusglobaltech.com",
    firstName: "Jon",
    lastName: "Doe",
    isActive: true,
    passwordHash: "hashed-password",
    role: { id: "role-1", name: RoleName.EMPLOYEE },
    department: { id: "dept-1", name: "Sales", managerTitle: "Sales Manager" },
    ...overrides,
  };
}

describe("AuthService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let jwt: { sign: jest.Mock };
  let config: { get: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = buildPrismaMock();
    jwt = { sign: jest.fn().mockReturnValue("signed.jwt.token") };
    config = { get: jest.fn((_key: string, fallback?: unknown) => fallback) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new AuthService(prisma as any, jwt as any, config as any);
  });

  describe("validateCredentials", () => {
    it("throws Invalid credentials when no user exists, without leaking which part was wrong", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.validateCredentials("nobody@x.com", "pw")).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.validateCredentials("nobody@x.com", "pw")).rejects.toThrow(
        "Invalid credentials",
      );
    });

    it("treats an inactive user the same as a nonexistent one (no enumeration)", async () => {
      prisma.user.findUnique.mockResolvedValue(buildActiveUser({ isActive: false }));
      await expect(service.validateCredentials("jon@venusglobaltech.com", "pw")).rejects.toThrow(
        "Invalid credentials",
      );
    });

    it("normalizes email casing/whitespace before looking the user up", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.validateCredentials("  Jon@VenusGlobalTech.com  ", "pw"),
      ).rejects.toThrow();
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: "jon@venusglobaltech.com" } }),
      );
    });

    it("throws Invalid credentials on a wrong password and records a LOGIN_FAILED event", async () => {
      prisma.user.findUnique.mockResolvedValue(buildActiveUser());
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(service.validateCredentials("jon@venusglobaltech.com", "wrong")).rejects.toThrow(
        "Invalid credentials",
      );
      expect(prisma.loginEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: AuthEventType.LOGIN_FAILED }),
        }),
      );
    });

    it("returns a RequestUser shape on a correct password", async () => {
      prisma.user.findUnique.mockResolvedValue(buildActiveUser());
      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.validateCredentials("jon@venusglobaltech.com", "correct");
      expect(result).toEqual({
        id: "user-1",
        email: "jon@venusglobaltech.com",
        firstName: "Jon",
        lastName: "Doe",
        role: { id: "role-1", name: RoleName.EMPLOYEE },
        department: { id: "dept-1", name: "Sales", managerTitle: "Sales Manager" },
      });
    });

    describe("lockout after repeated failures", () => {
      it("locks out (ForbiddenException) once 3 failures land inside the 15-minute window, without even checking the password", async () => {
        prisma.user.findUnique.mockResolvedValue(buildActiveUser());
        prisma.loginEvent.count.mockResolvedValue(3);

        await expect(
          service.validateCredentials("jon@venusglobaltech.com", "whatever"),
        ).rejects.toThrow(ForbiddenException);
        await expect(
          service.validateCredentials("jon@venusglobaltech.com", "whatever"),
        ).rejects.toThrow("Too many incorrect password attempts. Try again in 15 minutes.");
        expect(mockedBcrypt.compare).not.toHaveBeenCalled();
      });

      it("still allows an attempt at exactly 2 prior failures (threshold is >= 3, not > 2 loosely)", async () => {
        prisma.user.findUnique.mockResolvedValue(buildActiveUser());
        prisma.loginEvent.count.mockResolvedValue(2);
        mockedBcrypt.compare.mockResolvedValue(true as never);

        await expect(
          service.validateCredentials("jon@venusglobaltech.com", "correct"),
        ).resolves.toBeDefined();
      });

      it("does not lock out an ADMIN regardless of failure count", async () => {
        prisma.user.findUnique.mockResolvedValue(
          buildActiveUser({ role: { id: "role-admin", name: RoleName.ADMIN } }),
        );
        prisma.loginEvent.count.mockResolvedValue(99);
        mockedBcrypt.compare.mockResolvedValue(true as never);

        await expect(
          service.validateCredentials("jon@venusglobaltech.com", "correct"),
        ).resolves.toBeDefined();
        // Never even queried the failure count for an admin.
        expect(prisma.loginEvent.count).not.toHaveBeenCalled();
      });

      it("scopes the lockout window to a rolling 15 minutes ending now", async () => {
        prisma.user.findUnique.mockResolvedValue(buildActiveUser());
        prisma.loginEvent.count.mockResolvedValue(0);
        mockedBcrypt.compare.mockResolvedValue(true as never);

        const before = Date.now();
        await service.validateCredentials("jon@venusglobaltech.com", "correct");
        const call = prisma.loginEvent.count.mock.calls[0][0];
        const gte: Date = call.where.createdAt.gte;
        expect(before - gte.getTime()).toBeGreaterThanOrEqual(15 * 60 * 1000 - 1000);
        expect(before - gte.getTime()).toBeLessThanOrEqual(15 * 60 * 1000 + 1000);
      });
    });
  });

  describe("login", () => {
    it("issues an access token and a refresh token on success", async () => {
      prisma.user.findUnique.mockResolvedValue(buildActiveUser());
      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.login("jon@venusglobaltech.com", "correct");

      expect(result.accessToken).toBe("signed.jwt.token");
      expect(typeof result.refreshToken).toBe("string");
      expect(result.refreshToken.length).toBeGreaterThan(0);
      expect(result.refreshTokenExpiresAt).toBeInstanceOf(Date);
    });

    it("stores a hash of the refresh token, never the raw value", async () => {
      prisma.user.findUnique.mockResolvedValue(buildActiveUser());
      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.login("jon@venusglobaltech.com", "correct");

      const createCall = prisma.refreshToken.create.mock.calls[0][0];
      expect(createCall.data.tokenHash).not.toBe(result.refreshToken);
      expect(createCall.data.tokenHash).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
    });

    it("records a LOGIN audit event on success", async () => {
      prisma.user.findUnique.mockResolvedValue(buildActiveUser());
      mockedBcrypt.compare.mockResolvedValue(true as never);

      await service.login("jon@venusglobaltech.com", "correct");

      expect(prisma.loginEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: AuthEventType.LOGIN }) }),
      );
    });

    it("propagates lockout without ever issuing tokens", async () => {
      prisma.user.findUnique.mockResolvedValue(buildActiveUser());
      prisma.loginEvent.count.mockResolvedValue(3);

      await expect(service.login("jon@venusglobaltech.com", "whatever")).rejects.toThrow(
        ForbiddenException,
      );
      expect(jwt.sign).not.toHaveBeenCalled();
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it("reports termsAccepted: false for a user with no acceptance on record", async () => {
      prisma.user.findUnique.mockResolvedValue(buildActiveUser());
      mockedBcrypt.compare.mockResolvedValue(true as never);
      prisma.termsAcceptance.findFirst.mockResolvedValue(null);

      const result = await service.login("jon@venusglobaltech.com", "correct");

      expect(result.termsAccepted).toBe(false);
      expect(result.termsVersion).toBe(CURRENT_TERMS_VERSION);
      expect(result.termsText).toBe(TERMS_TEXT);
    });

    it("reports termsAccepted: false when the latest acceptance is an OLDER version", async () => {
      prisma.user.findUnique.mockResolvedValue(buildActiveUser());
      mockedBcrypt.compare.mockResolvedValue(true as never);
      prisma.termsAcceptance.findFirst.mockResolvedValue({ version: "some-old-version" });

      const result = await service.login("jon@venusglobaltech.com", "correct");
      expect(result.termsAccepted).toBe(false);
    });

    it("reports termsAccepted: true when the latest acceptance matches the current version", async () => {
      prisma.user.findUnique.mockResolvedValue(buildActiveUser());
      mockedBcrypt.compare.mockResolvedValue(true as never);
      prisma.termsAcceptance.findFirst.mockResolvedValue({ version: CURRENT_TERMS_VERSION });

      const result = await service.login("jon@venusglobaltech.com", "correct");
      expect(result.termsAccepted).toBe(true);
    });
  });

  describe("acceptTerms", () => {
    it("rejects a stale/mismatched version without writing anything", async () => {
      await expect(service.acceptTerms("user-1", "an-old-version")).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.termsAcceptance.create).not.toHaveBeenCalled();
    });

    it("records acceptance for the current version", async () => {
      await service.acceptTerms("user-1", CURRENT_TERMS_VERSION, {
        ipAddress: "1.2.3.4",
        userAgent: "test",
      });

      expect(prisma.termsAcceptance.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          version: CURRENT_TERMS_VERSION,
          ipAddress: "1.2.3.4",
          userAgent: "test",
        },
      });
    });
  });

  describe("refresh", () => {
    function activeTokenRecord(overrides: Partial<Record<string, unknown>> = {}) {
      return {
        id: "rt-1",
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        revokedAt: null,
        user: buildActiveUser(),
        ...overrides,
      };
    }

    it("rejects an unknown token", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(service.refresh("bogus")).rejects.toThrow(UnauthorizedException);
    });

    it("rejects a token belonging to a deactivated user", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(
        activeTokenRecord({ user: buildActiveUser({ isActive: false }) }),
      );
      await expect(service.refresh("token")).rejects.toThrow(
        "Invalid refresh token or account deactivated",
      );
    });

    it("rejects an expired token", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(
        activeTokenRecord({ expiresAt: new Date(Date.now() - 1000) }),
      );
      await expect(service.refresh("token")).rejects.toThrow("Expired refresh token");
    });

    it("rotates a never-revoked token: marks it revoked and issues new tokens", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(activeTokenRecord());

      const result = await service.refresh("token");

      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "rt-1" },
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
      expect(result.accessToken).toBe("signed.jwt.token");
    });

    it("allows reuse within the 24h grace window after rotation (race tolerance)", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(
        activeTokenRecord({ revokedAt: new Date(Date.now() - 1000 * 60 * 60) }), // revoked 1h ago
      );

      await expect(service.refresh("token")).resolves.toBeDefined();
      // Already-revoked tokens aren't re-updated on every grace-window reuse.
      expect(prisma.refreshToken.update).not.toHaveBeenCalled();
    });

    it("rejects reuse once the 24h grace window has passed", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(
        activeTokenRecord({ revokedAt: new Date(Date.now() - 1000 * 60 * 60 * 25) }), // revoked 25h ago
      );

      await expect(service.refresh("token")).rejects.toThrow("Invalid or revoked refresh token");
    });

    it("records which token replaced a rotated one", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(activeTokenRecord());
      prisma.refreshToken.create.mockResolvedValueOnce({ id: "rt-2" });

      await service.refresh("token");

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: "rt-1" },
        data: { revokedAt: expect.any(Date), replacedById: "rt-2" },
      });
    });

    it("after the grace window, still accepts a token whose replacement was never used (lost reply)", async () => {
      prisma.refreshToken.findUnique
        .mockResolvedValueOnce(
          activeTokenRecord({
            revokedAt: new Date(Date.now() - 1000 * 60 * 60 * 60), // a weekend ago
            replacedById: "rt-lost",
          }),
        )
        .mockResolvedValueOnce({ revokedAt: null, expiresAt: new Date(Date.now() + 60_000) });
      prisma.refreshToken.create.mockResolvedValueOnce({ id: "rt-3" });

      await expect(service.refresh("token")).resolves.toBeDefined();
      // Re-pointed at the token the client is about to get, so the old one dies once that's used.
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: "rt-1" },
        data: { replacedById: "rt-3" },
      });
    });

    it("after the grace window, rejects a token whose replacement was already used", async () => {
      prisma.refreshToken.findUnique
        .mockResolvedValueOnce(
          activeTokenRecord({
            revokedAt: new Date(Date.now() - 1000 * 60 * 60 * 25),
            replacedById: "rt-used",
          }),
        )
        .mockResolvedValueOnce({ revokedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) });

      await expect(service.refresh("token")).rejects.toThrow("Invalid or revoked refresh token");
    });

    it("after the grace window, rejects a token whose replacement was deleted by logout", async () => {
      prisma.refreshToken.findUnique
        .mockResolvedValueOnce(
          activeTokenRecord({
            revokedAt: new Date(Date.now() - 1000 * 60 * 60 * 25),
            replacedById: "rt-gone",
          }),
        )
        .mockResolvedValueOnce(null);

      await expect(service.refresh("token")).rejects.toThrow("Invalid or revoked refresh token");
    });
  });

  describe("logout", () => {
    it("deletes only the presented token, leaving the user's other sessions signed in", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({ userId: "user-1" });

      await service.logout("some-raw-token");

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledTimes(1);
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { tokenHash: expect.any(String) },
      });
      expect(prisma.loginEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: AuthEventType.LOGOUT }) }),
      );
    });

    it("refuses to sign out a normal user who has not been granted sign-out, keeping the session", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        userId: "user-1",
        user: { canSignOut: false, role: { name: "EMPLOYEE" } },
      });

      await expect(service.logout("some-raw-token")).rejects.toThrow("Signing out is disabled");
      expect(prisma.refreshToken.deleteMany).not.toHaveBeenCalled();
    });

    it("signs out a user an admin has granted sign-out, and always signs out admins", async () => {
      prisma.refreshToken.findUnique.mockResolvedValueOnce({
        userId: "user-1",
        user: { canSignOut: true, role: { name: "EMPLOYEE" } },
      });
      await service.logout("some-raw-token");
      prisma.refreshToken.findUnique.mockResolvedValueOnce({
        userId: "user-2",
        user: { canSignOut: false, role: { name: "ADMIN" } },
      });
      await service.logout("other-raw-token");

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledTimes(2);
    });

    it("records no LOGOUT event when the token is already unknown", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await service.logout("some-raw-token");

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { tokenHash: expect.any(String) },
      });
      expect(prisma.loginEvent.create).not.toHaveBeenCalled();
    });
  });

  describe("requestPasswordReset", () => {
    it("resolves silently and sends no email for a nonexistent user (anti-enumeration)", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.requestPasswordReset("nobody@x.com")).resolves.toBeUndefined();
      expect(mockedSendEmail).not.toHaveBeenCalled();
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it("resolves silently and sends no email for a deactivated user", async () => {
      prisma.user.findUnique.mockResolvedValue(buildActiveUser({ isActive: false }));
      await expect(
        service.requestPasswordReset("jon@venusglobaltech.com"),
      ).resolves.toBeUndefined();
      expect(mockedSendEmail).not.toHaveBeenCalled();
    });

    it("creates a token and sends an email for an active user", async () => {
      prisma.user.findUnique.mockResolvedValue(buildActiveUser());
      await service.requestPasswordReset("jon@venusglobaltech.com");
      expect(prisma.passwordResetToken.create).toHaveBeenCalled();
      expect(mockedSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: "jon@venusglobaltech.com" }),
      );
    });
  });

  describe("resetPassword", () => {
    it("rejects an unknown token", async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(null);
      await expect(service.resetPassword("bogus", "newpw")).rejects.toThrow(BadRequestException);
    });

    it("rejects an already-used token", async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: "prt-1",
        userId: "user-1",
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      });
      await expect(service.resetPassword("token", "newpw")).rejects.toThrow(
        "This reset link is invalid or has expired. Request a new one.",
      );
    });

    it("rejects an expired token", async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: "prt-1",
        userId: "user-1",
        usedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.resetPassword("token", "newpw")).rejects.toThrow(BadRequestException);
    });

    it("updates the password, marks the token used, and deletes all refresh tokens in one transaction", async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: "prt-1",
        userId: "user-1",
        usedAt: null,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      });
      prisma.$transaction.mockResolvedValue([{}, {}, {}]);

      await service.resetPassword("token", "brand-new-password");

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const ops = prisma.$transaction.mock.calls[0][0];
      expect(Array.isArray(ops)).toBe(true);
      expect(ops).toHaveLength(3);
    });
  });
});
