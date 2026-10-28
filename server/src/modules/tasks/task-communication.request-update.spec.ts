import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { NotificationType, TaskMessageType } from "@prisma/client";
import { TaskCommunicationService } from "./task-communication.service";
import type { RequestUser } from "../../common/types/request-user.type";

const makeUser = (role: string, id: string, departmentId = "d1") =>
  ({
    id,
    email: `${id}@x.com`,
    firstName: id,
    lastName: "Lead",
    role: { id: "r", name: role },
    department: { id: departmentId, name: "Recruitment", managerTitle: "Manager" },
  }) as unknown as RequestUser;

const admin = makeUser("ADMIN", "admin1");
const manager = makeUser("MANAGER", "mgr1");
const employee = makeUser("EMPLOYEE", "e1");

function makeTask(over: Record<string, unknown> = {}) {
  return {
    id: "t1",
    title: "Source 10 candidates",
    assigneeId: "e1",
    assignee: { id: "e1" },
    assignees: [],
    creatorId: "mgr1",
    departmentId: "d1",
    project: null,
    ...over,
  };
}

function makeService(task: unknown = makeTask()) {
  const prisma = {
    task: {
      findUnique: jest.fn().mockResolvedValue(task),
      update: jest.fn().mockResolvedValue({}),
    },
    taskMessage: {
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: `m-${data.recipientId}`, ...data })),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const chat = {
    getOrCreateDM: jest.fn().mockResolvedValue({ id: "dm1" }),
    sendMessage: jest.fn().mockResolvedValue({ id: "chat1" }),
  };
  const notifications = { create: jest.fn().mockResolvedValue({}) };
  const service = new TaskCommunicationService(prisma as never, chat as never, notifications as never);
  return { service, prisma, chat, notifications };
}

beforeEach(() => {
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("TaskCommunicationService.requestUpdate", () => {
  it("lets only Managers and Admins ask for an update", async () => {
    const { service, prisma } = makeService();
    await expect(service.requestUpdate("t1", {}, employee)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.taskMessage.create).not.toHaveBeenCalled();
  });

  it("404s for an unknown task", async () => {
    const { service } = makeService(null);
    await expect(service.requestUpdate("nope", {}, admin)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects a Manager from another department with no link to the task", async () => {
    const { service } = makeService(makeTask({ creatorId: "someone", departmentId: "d1" }));
    await expect(service.requestUpdate("t1", {}, makeUser("MANAGER", "other-mgr", "d99"))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("errors clearly when the task has nobody assigned", async () => {
    const { service } = makeService(makeTask({ assigneeId: null, assignee: null, assignees: [] }));
    await expect(service.requestUpdate("t1", {}, admin)).rejects.toThrow(/no assigned employee/);
  });

  it("asks the assignee: thread message, team-chat DM and a bell notification", async () => {
    const { service, prisma, chat, notifications } = makeService();
    const result = await service.requestUpdate("t1", { note: "  Any blockers?  " }, manager);

    expect(prisma.taskMessage.create.mock.calls[0][0].data).toEqual({
      taskId: "t1",
      senderId: "mgr1",
      recipientId: "e1",
      message: "Any blockers?",
      messageType: TaskMessageType.UPDATE_REQUEST,
    });
    expect(chat.getOrCreateDM).toHaveBeenCalledWith("e1", manager);
    expect(chat.sendMessage.mock.calls[0][1]).toContain("Any blockers?");
    expect(prisma.taskMessage.update).toHaveBeenCalledWith({
      where: { id: "m-e1" },
      data: { teamChatMessageId: "chat1" },
    });
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "e1",
        type: NotificationType.TASK_UPDATE_REQUESTED,
        link: "/tasks?taskId=t1&modal=communication",
      }),
    );
    expect(notifications.create.mock.calls[0][0].message).toContain("Manager (mgr1 Lead)");
    expect(result).toMatchObject({ recipientId: "e1" });
  });

  it("names the requester as 'Admin' when an Admin asks", async () => {
    const { service, notifications } = makeService();
    await service.requestUpdate("t1", {}, admin);
    expect(notifications.create.mock.calls[0][0].message).toContain("Admin (admin1 Lead)");
  });

  it("uses a sensible default note", async () => {
    const { service, prisma } = makeService();
    await service.requestUpdate("t1", {}, admin);
    expect(prisma.taskMessage.create.mock.calls[0][0].data.message).toMatch(/provide an update/i);
  });

  it("records when the update was requested", async () => {
    const { service, prisma } = makeService();
    await service.requestUpdate("t1", {}, admin);
    expect(prisma.task.update.mock.calls[0][0].data.lastUpdateRequestAt).toBeInstanceOf(Date);
  });

  it("asks EVERY assignee on a multi-assignee task, not just the first", async () => {
    const task = makeTask({ assignees: [{ userId: "e2" }, { userId: "e3" }, { userId: "e1" }] });
    const { service, prisma, notifications, chat } = makeService(task);
    await service.requestUpdate("t1", {}, admin);

    expect(prisma.taskMessage.create.mock.calls.map(([c]) => c.data.recipientId)).toEqual(["e1", "e2", "e3"]);
    expect(notifications.create.mock.calls.map(([c]) => c.userId)).toEqual(["e1", "e2", "e3"]);
    expect(chat.getOrCreateDM).toHaveBeenCalledTimes(3);
  });

  it("works when the task only has entries in the multi-assignee list", async () => {
    const task = makeTask({ assigneeId: null, assignee: null, assignees: [{ userId: "e2" }] });
    const { service, notifications } = makeService(task);
    await service.requestUpdate("t1", {}, admin);
    expect(notifications.create.mock.calls.map(([c]) => c.userId)).toEqual(["e2"]);
  });

  it("doesn't ask the requester for an update on their own task", async () => {
    const task = makeTask({ assigneeId: "mgr1", assignee: { id: "mgr1" }, assignees: [{ userId: "e2" }] });
    const { service, notifications } = makeService(task);
    await service.requestUpdate("t1", {}, manager);
    expect(notifications.create.mock.calls.map(([c]) => c.userId)).toEqual(["e2"]);
  });

  it("still notifies when the team-chat post fails", async () => {
    const { service, chat, notifications } = makeService();
    chat.getOrCreateDM.mockRejectedValue(new Error("chat down"));
    await expect(service.requestUpdate("t1", {}, admin)).resolves.toBeDefined();
    expect(notifications.create).toHaveBeenCalledTimes(1);
  });

  it("doesn't fail the request when the bell notification fails", async () => {
    const { service, prisma, notifications } = makeService();
    notifications.create.mockRejectedValue(new Error("socket down"));
    await expect(service.requestUpdate("t1", {}, admin)).resolves.toBeDefined();
    expect(prisma.taskMessage.create).toHaveBeenCalled(); // the thread record still exists
  });
});
