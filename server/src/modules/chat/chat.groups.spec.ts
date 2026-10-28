import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { ChatService } from "./chat.service";
import type { RequestUser } from "../../common/types/request-user.type";

const person = (id: string) => ({ id, firstName: id.toUpperCase(), lastName: "Person", avatarUrl: null });
const as = (id: string, role = "EMPLOYEE"): RequestUser =>
  ({ id, firstName: id.toUpperCase(), lastName: "Person", role: { name: role }, department: null }) as unknown as RequestUser;

const member = (userId: string, isAdmin = false) => ({ userId, isAdmin, joinedAt: new Date(), user: person(userId) });

function make(members: ReturnType<typeof member>[] = []) {
  const prisma: any = {
    user: { findMany: jest.fn(async ({ where }: any) => where.id.in.map(person)) },
    chatChannel: {
      create: jest.fn(async ({ data }: any) => ({ id: "g1", ...data })),
      findUnique: jest.fn(async () => ({ id: "g1", name: "Team", isGroup: true, isDM: false, members })),
      findUniqueOrThrow: jest.fn(async () => ({ id: "g1" })),
      update: jest.fn(async () => ({ id: "g1" })),
      delete: jest.fn(async () => ({})),
    },
    chatChannelMember: {
      createMany: jest.fn(async () => ({})),
      delete: jest.fn(async () => ({})),
      update: jest.fn(async () => ({})),
      findUnique: jest.fn(async ({ where }: any) =>
        members.find((m) => m.userId === where.channelId_userId.userId) ?? null,
      ),
      findMany: jest.fn(async () => []),
    },
    chatMessage: { create: jest.fn(async ({ data }: any) => ({ id: "m1", ...data })) },
    chatChannelRead: { upsert: jest.fn(async () => ({})) },
  };
  const notifications = { create: jest.fn(async () => ({})) };
  const service = new ChatService(prisma as any, notifications as any);
  return { service, prisma, notifications };
}

describe("ChatService groups — creating", () => {
  it("makes the creator the first admin and adds everyone picked", async () => {
    const { service, prisma, notifications } = make();
    await service.createGroup({ name: "  Night crew ", memberIds: ["b", "c"] }, as("a"));
    const data = prisma.chatChannel.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ name: "Night crew", isGroup: true, isDM: false, createdById: "a" });
    expect(data.members.create).toEqual([
      { userId: "a", isAdmin: true },
      { userId: "b", isAdmin: false },
      { userId: "c", isAdmin: false },
    ]);
    expect(prisma.chatMessage.create.mock.calls[0]![0].data.isSystem).toBe(true);
    expect(notifications.create).toHaveBeenCalledTimes(2); // b and c, not the creator
  });

  it("ignores duplicates and the creator in the picked list, and needs at least one other person", async () => {
    const { service } = make();
    await expect(service.createGroup({ name: "Solo", memberIds: ["a", "a"] }, as("a"))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("rejects people who can't be found or are inactive", async () => {
    const { service, prisma } = make();
    prisma.user.findMany.mockResolvedValue([person("b")]); // c missing
    await expect(service.createGroup({ name: "G", memberIds: ["b", "c"] }, as("a"))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("rejects a blank name", async () => {
    const { service } = make();
    await expect(service.createGroup({ name: "   ", memberIds: ["b"] }, as("a"))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe("ChatService groups — access", () => {
  it("lets only members send messages, even an org Admin", async () => {
    const members = [member("a", true), member("b")];
    const { service, prisma } = make(members);
    prisma.chatChannel.findUnique.mockResolvedValue({ id: "g1", name: "Team", isGroup: true, isDM: false, departmentId: null, dmUserId1: null, dmUserId2: null });
    await expect(service.sendMessage("g1", "hi", as("outsider", "ADMIN"))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.sendMessage("g1", "hi", as("b"))).resolves.toBeDefined();
  });

  it("notifies every other member of a group message, not the sender", async () => {
    const members = [member("a", true), member("b"), member("c")];
    const { service, prisma, notifications } = make(members);
    prisma.chatChannel.findUnique.mockResolvedValue({ id: "g1", name: "Team", isGroup: true, isDM: false, departmentId: null, dmUserId1: null, dmUserId2: null });
    prisma.chatChannelMember.findMany.mockResolvedValue([{ userId: "b" }, { userId: "c" }]);
    await service.sendMessage("g1", "hello all", as("a"));
    expect(notifications.create.mock.calls.map((c: any[]) => c[0].userId)).toEqual(["b", "c"]);
  });
});

describe("ChatService groups — managing members", () => {
  it("only group admins can add people, and already-present people are skipped", async () => {
    const members = [member("a", true), member("b")];
    const { service, prisma } = make(members);
    await expect(service.addGroupMembers("g1", ["c"], as("b"))).rejects.toBeInstanceOf(ForbiddenException);
    await service.addGroupMembers("g1", ["b", "c"], as("a"));
    expect(prisma.chatChannelMember.createMany.mock.calls[0][0].data).toEqual([
      { channelId: "g1", userId: "c", isAdmin: false },
    ]);
    await expect(service.addGroupMembers("g1", ["b"], as("a"))).rejects.toBeInstanceOf(BadRequestException);
  });

  it("only group admins can remove others, but anyone can leave", async () => {
    const members = [member("a", true), member("b"), member("c")];
    const { service, prisma } = make(members);
    await expect(service.removeGroupMember("g1", "c", as("b"))).rejects.toBeInstanceOf(ForbiddenException);
    await service.removeGroupMember("g1", "b", as("b")); // leaves
    expect(prisma.chatChannelMember.delete).toHaveBeenCalledWith({
      where: { channelId_userId: { channelId: "g1", userId: "b" } },
    });
  });

  it("promotes the longest-standing member when the last admin leaves", async () => {
    const members = [member("a", true), member("b"), member("c")];
    const { service, prisma } = make(members);
    await service.removeGroupMember("g1", "a", as("a"));
    expect(prisma.chatChannelMember.update).toHaveBeenCalledWith({
      where: { channelId_userId: { channelId: "g1", userId: "b" } },
      data: { isAdmin: true },
    });
  });

  it("deletes the group when the last member leaves", async () => {
    const { service, prisma } = make([member("a", true)]);
    await expect(service.removeGroupMember("g1", "a", as("a"))).resolves.toEqual({ deleted: true });
    expect(prisma.chatChannel.delete).toHaveBeenCalledWith({ where: { id: "g1" } });
  });

  it("only group admins can rename, and the rename is posted as a system line", async () => {
    const members = [member("a", true), member("b")];
    const { service, prisma } = make(members);
    await expect(service.updateGroup("g1", { name: "New" }, as("b"))).rejects.toBeInstanceOf(ForbiddenException);
    await service.updateGroup("g1", { name: "New" }, as("a"));
    expect(prisma.chatChannel.update.mock.calls[0][0].data).toEqual({ name: "New" });
    expect(prisma.chatMessage.create.mock.calls[0][0].data.content).toContain('renamed the group to "New"');
  });
});
