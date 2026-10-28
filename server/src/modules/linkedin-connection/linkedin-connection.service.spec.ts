import { Test, TestingModule } from "@nestjs/testing";
import { LinkedInConnectionStatus } from "@prisma/client";
import { LinkedInConnectionService } from "./linkedin-connection.service";
import { UnipileService } from "./unipile.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../common/types/request-user.type";

describe("LinkedInConnectionService", () => {
  let service: LinkedInConnectionService;
  let prisma: {
    userLinkedInConnection: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      create: jest.Mock;
    };
    linkedInAction: {
      create: jest.Mock;
      findMany: jest.Mock;
    };
    linkedInMessage: {
      create: jest.Mock;
    };
  };
  let unipile: {
    isConfigured: jest.Mock;
    getConnectedAccount: jest.Mock;
    resolveProfile: jest.Mock;
    sendInvitation: jest.Mock;
    sendMessage: jest.Mock;
    getChats: jest.Mock;
    getApiKey: jest.Mock;
    getDefaultAccountId: jest.Mock;
  };

  const user = {
    id: "user-1",
    email: "rep@venushiring.com",
    firstName: "Sales",
    lastName: "Rep",
    role: { id: "r1", name: "EMPLOYEE" },
    departmentId: "d1",
  } as unknown as RequestUser;

  beforeEach(async () => {
    prisma = {
      userLinkedInConnection: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        create: jest.fn(),
      },
      linkedInAction: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      linkedInMessage: {
        create: jest.fn(),
      },
    };

    unipile = {
      isConfigured: jest.fn().mockReturnValue(false),
      getConnectedAccount: jest.fn(),
      resolveProfile: jest.fn(),
      sendInvitation: jest.fn(),
      sendMessage: jest.fn(),
      getChats: jest.fn(),
      getApiKey: jest.fn().mockReturnValue("mock-api-key"),
      getDefaultAccountId: jest.fn().mockReturnValue("mock-acc-id"),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinkedInConnectionService,
        { provide: PrismaService, useValue: prisma },
        { provide: UnipileService, useValue: unipile },
      ],
    }).compile();

    service = module.get<LinkedInConnectionService>(LinkedInConnectionService);
  });

  describe("getStatus", () => {
    it("returns connected: false when no connection exists and unipile not configured", async () => {
      prisma.userLinkedInConnection.findUnique.mockResolvedValue(null);
      const res = await service.getStatus(user);
      expect(res.connected).toBe(false);
      expect(res.connection).toBeNull();
    });

    it("returns connected: true with remaining limits when connected", async () => {
      const today = new Date().toISOString().slice(0, 10);
      prisma.userLinkedInConnection.findUnique.mockResolvedValue({
        id: "conn-1",
        userId: "user-1",
        accountEmail: "rep.li@linkedin.com",
        accountName: "Sales Rep",
        profileUrl: "https://linkedin.com/in/salesrep",
        profilePicUrl: "https://example.com/pic.jpg",
        profileUrn: "urn:li:person:123",
        accessToken: "secret-token",
        status: LinkedInConnectionStatus.CONNECTED,
        dailyInviteLimit: 25,
        dailyMessageLimit: 60,
        invitesSentToday: 5,
        messagesSentToday: 10,
        lastResetDate: today,
        lastSyncAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.getStatus(user);
      expect(res.connected).toBe(true);
      expect(res.connection?.accountEmail).toBe("rep.li@linkedin.com");
      expect(res.connection?.remainingInvitesToday).toBe(20);
      expect(res.connection?.remainingMessagesToday).toBe(50);
      expect((res.connection as any).accessToken).toBeUndefined();
    });

    it("resets daily counts when lastResetDate is from a previous day", async () => {
      const today = new Date().toISOString().slice(0, 10);
      prisma.userLinkedInConnection.findUnique.mockResolvedValue({
        id: "conn-1",
        userId: "user-1",
        accountEmail: "rep.li@linkedin.com",
        accountName: "Sales Rep",
        profileUrl: null,
        profilePicUrl: null,
        profileUrn: null,
        accessToken: "secret",
        status: LinkedInConnectionStatus.CONNECTED,
        dailyInviteLimit: 20,
        dailyMessageLimit: 50,
        invitesSentToday: 18,
        messagesSentToday: 45,
        lastResetDate: "2026-10-10",
        lastSyncAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      prisma.userLinkedInConnection.update.mockResolvedValue({
        id: "conn-1",
        userId: "user-1",
        accountEmail: "rep.li@linkedin.com",
        accountName: "Sales Rep",
        profileUrl: null,
        profilePicUrl: null,
        profileUrn: null,
        accessToken: "secret",
        status: LinkedInConnectionStatus.CONNECTED,
        dailyInviteLimit: 20,
        dailyMessageLimit: 50,
        invitesSentToday: 0,
        messagesSentToday: 0,
        lastResetDate: today,
        lastSyncAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.getStatus(user);
      expect(prisma.userLinkedInConnection.update).toHaveBeenCalledWith({
        where: { id: "conn-1" },
        data: {
          invitesSentToday: 0,
          messagesSentToday: 0,
          lastResetDate: today,
        },
      });
      expect(res.connection?.invitesSentToday).toBe(0);
      expect(res.connection?.remainingInvitesToday).toBe(20);
    });
  });

  describe("connect", () => {
    it("upserts the connection and returns formatted response", async () => {
      const today = new Date().toISOString().slice(0, 10);
      prisma.userLinkedInConnection.upsert.mockResolvedValue({
        id: "conn-new",
        userId: "user-1",
        accountEmail: "sourav.li@linkedin.com",
        accountName: "Sourav Sahoo",
        profileUrl: "https://linkedin.com/in/souravsahoo",
        profilePicUrl: null,
        profileUrn: null,
        accessToken: "tok-123",
        status: LinkedInConnectionStatus.CONNECTED,
        dailyInviteLimit: 20,
        dailyMessageLimit: 50,
        invitesSentToday: 0,
        messagesSentToday: 0,
        lastResetDate: today,
        lastSyncAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.connect(user, {
        accountEmail: "sourav.li@linkedin.com",
        accountName: "Sourav Sahoo",
        profileUrl: "https://linkedin.com/in/souravsahoo",
      });

      expect(res.connected).toBe(true);
      expect(res.connection?.accountEmail).toBe("sourav.li@linkedin.com");
      expect(res.connection?.dailyInviteLimit).toBe(20);
    });
  });

  describe("disconnect", () => {
    it("deletes the connection if present", async () => {
      prisma.userLinkedInConnection.findUnique.mockResolvedValue({ id: "conn-1" });
      prisma.userLinkedInConnection.delete.mockResolvedValue({ id: "conn-1" });

      const res = await service.disconnect(user);
      expect(res.success).toBe(true);
      expect(prisma.userLinkedInConnection.delete).toHaveBeenCalledWith({ where: { id: "conn-1" } });
    });
  });

  describe("updateLimits", () => {
    it("updates limits safely", async () => {
      const today = new Date().toISOString().slice(0, 10);
      prisma.userLinkedInConnection.findUnique.mockResolvedValue({ id: "conn-1" });
      prisma.userLinkedInConnection.update.mockResolvedValue({
        id: "conn-1",
        accountEmail: "rep@li.com",
        accountName: null,
        profileUrl: null,
        profilePicUrl: null,
        profileUrn: null,
        status: LinkedInConnectionStatus.CONNECTED,
        dailyInviteLimit: 30,
        dailyMessageLimit: 80,
        invitesSentToday: 0,
        messagesSentToday: 0,
        lastResetDate: today,
        lastSyncAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.updateLimits(user, { dailyInviteLimit: 30, dailyMessageLimit: 80 });
      expect(res.connection?.dailyInviteLimit).toBe(30);
      expect(res.connection?.dailyMessageLimit).toBe(80);
    });
  });
});
