import { NotificationType, TaskMessageType, TaskStatus } from "@prisma/client";
import { DUE_SOON_WINDOW_MS, TaskDeadlineService } from "./task-deadline.service";
import { collectAssigneeIds, formatSpan } from "./task-deadline.util";

// 11:30 IST on 2026-10-05.
const NOW = new Date("2026-10-05T06:00:00Z");
const HOUR = 60 * 60 * 1000;

type Over = Record<string, unknown>;

const person = (id: string, departmentId: string | null = "d1") => ({
  id,
  firstName: id.toUpperCase(),
  lastName: "Person",
  departmentId,
});

function makeTask(over: Over = {}) {
  return {
    id: "t1",
    title: "Ship report",
    status: TaskStatus.IN_PROGRESS,
    dueDate: new Date(NOW.getTime() - 2 * HOUR), // 2h overdue
    overdueNotifiedAt: null,
    dueSoonNotifiedFor: null,
    assigneeId: "e1",
    assignee: person("e1"),
    assignees: [],
    testerId: null,
    departmentId: null,
    project: null,
    creator: { ...person("c1", "d9"), role: { name: "EMPLOYEE" } },
    ...over,
  };
}

function makeService(tasks: unknown[] = [], opts: { admins?: string[]; managers?: string[] } = {}) {
  const prisma = {
    task: {
      findMany: jest.fn().mockResolvedValue(tasks),
      update: jest.fn().mockResolvedValue({}),
    },
    taskMessage: { create: jest.fn().mockResolvedValue({}) },
    user: {
      findMany: jest.fn().mockImplementation(({ where }) => {
        if (where?.role?.name === "ADMIN") return Promise.resolve((opts.admins ?? ["admin1"]).map((id) => ({ id })));
        return Promise.resolve((opts.managers ?? []).map((id) => ({ id })));
      }),
    },
  };
  const notifications = { create: jest.fn().mockResolvedValue({}) };
  const service = new TaskDeadlineService(prisma as never, notifications as never);
  return { service, prisma, notifications };
}

const sent = (n: { create: jest.Mock }) => n.create.mock.calls.map(([c]) => c);
const forUser = (n: { create: jest.Mock }, id: string) => sent(n).filter((c) => c.userId === id);

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => jest.useRealTimers());

describe("collectAssigneeIds", () => {
  it("returns the primary assignee first, then the rest, without duplicates", () => {
    expect(collectAssigneeIds({ assigneeId: "a", assignees: [{ userId: "b" }, { userId: "a" }, { userId: "c" }] })).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
  it("copes with no primary, no list, or empty values", () => {
    expect(collectAssigneeIds({})).toEqual([]);
    expect(collectAssigneeIds({ assigneeId: null, assignees: null })).toEqual([]);
    expect(collectAssigneeIds({ assignees: [{ userId: "x" }] })).toEqual(["x"]);
  });
});

describe("formatSpan", () => {
  it.each([
    [0, "0 min"],
    [45 * 60_000, "45 min"],
    [60 * 60_000, "1 h"],
    [125 * 60_000, "2 h 5 min"],
    [24 * HOUR, "1 d"],
    [28 * HOUR, "1 d 4 h"],
    [-5000, "0 min"],
  ])("%d ms -> %s", (ms, expected) => expect(formatSpan(ms)).toBe(expected));
});

describe("TaskDeadlineService.checkOverdueTasks — selection", () => {
  it("asks only for past-due tasks that are not DONE", async () => {
    const { service, prisma } = makeService();
    await service.checkOverdueTasks();
    expect(prisma.task.findMany.mock.calls[0][0].where).toEqual({
      dueDate: { not: null, lt: NOW },
      status: { not: TaskStatus.DONE },
    });
  });

  it("does nothing (and looks up no users) when nothing is overdue", async () => {
    const { service, prisma, notifications } = makeService([]);
    await service.checkOverdueTasks();
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it("alerts once per deadline: skips a task already notified for this due date", async () => {
    const task = makeTask({ overdueNotifiedAt: new Date(NOW.getTime() - HOUR) }); // after the due date
    const { service, notifications } = makeService([task]);
    await service.checkOverdueTasks();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it("alerts again when the deadline was pushed past the last alert", async () => {
    const task = makeTask({
      overdueNotifiedAt: new Date(NOW.getTime() - 5 * HOUR), // before the (new) due date
    });
    const { service, notifications } = makeService([task]);
    await service.checkOverdueTasks();
    expect(notifications.create).toHaveBeenCalled();
  });
});

describe("TaskDeadlineService.checkOverdueTasks — who is told", () => {
  it("tells the assignee directly that THEIR task is overdue", async () => {
    const { service, notifications } = makeService([makeTask()]);
    await service.checkOverdueTasks();

    const mine = forUser(notifications, "e1");
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({
      type: NotificationType.TASK_OVERDUE,
      title: "⚠️ Your task is overdue",
      link: "/tasks?taskId=t1&modal=communication",
    });
    expect(mine[0].message).toContain('"Ship report"');
    expect(mine[0].message).toContain("2 h ago");
  });

  it("tells Admins that the assignee missed the deadline", async () => {
    const { service, notifications } = makeService([makeTask()], { admins: ["admin1", "admin2"] });
    await service.checkOverdueTasks();

    for (const id of ["admin1", "admin2"]) {
      const [n] = forUser(notifications, id);
      expect(n).toMatchObject({ type: NotificationType.TASK_OVERDUE, title: "⚠️ Task Deadline Missed" });
      expect(n.message).toContain("E1 Person has not completed");
    }
  });

  it("tells department managers, the reviewer, and a Manager/Admin creator", async () => {
    const task = makeTask({ testerId: "tester1", creator: { ...person("boss", "d9"), role: { name: "MANAGER" } } });
    const { service, notifications, prisma } = makeService([task], { managers: ["mgr1"] });
    await service.checkOverdueTasks();

    const recipients = sent(notifications).map((c) => c.userId);
    expect(recipients).toEqual(expect.arrayContaining(["e1", "admin1", "tester1", "boss", "mgr1"]));
    // Looked up managers of the assignee's, creator's departments.
    const deptQuery = prisma.user.findMany.mock.calls.find(([a]) => a.where.departmentId)![0];
    expect(deptQuery.where.departmentId.in).toEqual(expect.arrayContaining(["d1", "d9"]));
  });

  it("does not notify an Employee creator", async () => {
    const { service, notifications } = makeService([makeTask()]);
    await service.checkOverdueTasks();
    expect(forUser(notifications, "c1")).toHaveLength(0);
  });

  it("covers every assignee on a multi-assignee task, and their departments", async () => {
    const task = makeTask({
      assignees: [
        { userId: "e1", user: person("e1", "d1") },
        { userId: "e2", user: person("e2", "d2") },
      ],
    });
    const { service, notifications, prisma } = makeService([task], { managers: ["mgr-d2"] });
    await service.checkOverdueTasks();

    for (const id of ["e1", "e2"]) {
      expect(forUser(notifications, id)[0].title).toBe("⚠️ Your task is overdue");
    }
    expect(forUser(notifications, "admin1")[0].message).toContain("E1 Person, E2 Person");
    const deptQuery = prisma.user.findMany.mock.calls.find(([a]) => a.where.departmentId)![0];
    expect(deptQuery.where.departmentId.in).toEqual(expect.arrayContaining(["d1", "d2"]));
  });

  it("sends an assignee who is also an Admin/Manager just the direct message, not two", async () => {
    const { service, notifications } = makeService([makeTask()], { admins: ["e1", "admin2"] });
    await service.checkOverdueTasks();
    const mine = forUser(notifications, "e1");
    expect(mine).toHaveLength(1);
    expect(mine[0].title).toBe("⚠️ Your task is overdue");
  });

  it("still alerts oversight when the task has no assignee", async () => {
    const task = makeTask({ assigneeId: null, assignee: null });
    const { service, notifications } = makeService([task]);
    await service.checkOverdueTasks();

    expect(forUser(notifications, "admin1")[0].message).toContain("Assigned employee has not completed");
    expect(sent(notifications).every((c) => c.title === "⚠️ Task Deadline Missed")).toBe(true);
  });
});

describe("TaskDeadlineService.checkOverdueTasks — thread + bookkeeping", () => {
  it("adds a system OVERDUE_MESSAGE to the thread for each assignee", async () => {
    const task = makeTask({ assignees: [{ userId: "e2", user: person("e2") }] });
    const { service, prisma } = makeService([task]);
    await service.checkOverdueTasks();

    const rows = prisma.taskMessage.create.mock.calls.map(([c]) => c.data);
    expect(rows.map((r) => r.recipientId).sort()).toEqual(["e1", "e2"]);
    for (const r of rows) {
      expect(r).toMatchObject({ taskId: "t1", senderId: null, messageType: TaskMessageType.OVERDUE_MESSAGE });
      expect(r.message).toContain("Task Deadline Missed");
    }
  });

  it("adds one open-ended thread message when nobody is assigned", async () => {
    const { service, prisma } = makeService([makeTask({ assigneeId: null, assignee: null })]);
    await service.checkOverdueTasks();
    expect(prisma.taskMessage.create).toHaveBeenCalledTimes(1);
    expect(prisma.taskMessage.create.mock.calls[0][0].data.recipientId).toBeNull();
  });

  it("marks the task notified only after the notifications were sent", async () => {
    const { service, prisma, notifications } = makeService([makeTask()]);
    await service.checkOverdueTasks();

    expect(prisma.task.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { overdueNotifiedAt: NOW } });
    const lastNotify = Math.max(...notifications.create.mock.invocationCallOrder);
    expect(prisma.task.update.mock.invocationCallOrder[0]).toBeGreaterThan(lastNotify);
  });

  it("one failed notification doesn't stop the others or the bookkeeping", async () => {
    const { service, prisma, notifications } = makeService([makeTask()], { admins: ["admin1"] });
    notifications.create.mockRejectedValueOnce(new Error("socket down")); // the assignee's
    await service.checkOverdueTasks();

    expect(forUser(notifications, "admin1")).toHaveLength(1);
    expect(prisma.task.update).toHaveBeenCalled();
  });

  it("a task that blows up doesn't block the next one", async () => {
    const { service, prisma, notifications } = makeService([makeTask({ id: "bad" }), makeTask({ id: "good" })]);
    prisma.taskMessage.create.mockRejectedValueOnce(new Error("db hiccup"));
    await service.checkOverdueTasks();

    expect(notifications.create.mock.calls.some(([c]) => c.link.includes("taskId=good"))).toBe(true);
    // The failed task is NOT marked, so the next tick retries it.
    expect(prisma.task.update.mock.calls.map(([c]) => c.where.id)).toEqual(["good"]);
  });

  it("swallows a top-level failure instead of crashing the scheduler", async () => {
    const { service, prisma } = makeService();
    prisma.task.findMany.mockRejectedValue(new Error("db down"));
    await expect(service.checkOverdueTasks()).resolves.toBeUndefined();
  });
});

describe("TaskDeadlineService.checkDueSoonTasks", () => {
  const dueIn = (min: number) => new Date(NOW.getTime() + min * 60_000);

  it("looks for undone tasks due within the next hour", async () => {
    const { service, prisma } = makeService();
    await service.checkDueSoonTasks();
    expect(DUE_SOON_WINDOW_MS).toBe(HOUR);
    expect(prisma.task.findMany.mock.calls[0][0].where).toEqual({
      dueDate: { gt: NOW, lte: new Date(NOW.getTime() + HOUR) },
      status: { not: TaskStatus.DONE },
    });
  });

  it("reminds the assignee and records which deadline it reminded about", async () => {
    const due = dueIn(45);
    const { service, prisma, notifications } = makeService([makeTask({ dueDate: due })]);
    await service.checkDueSoonTasks();

    expect(sent(notifications)).toHaveLength(1);
    expect(sent(notifications)[0]).toMatchObject({
      userId: "e1",
      type: NotificationType.TASK_DUE_SOON,
      title: "⏰ Task due soon",
      link: "/tasks?taskId=t1&modal=communication",
    });
    expect(sent(notifications)[0].message).toContain("due in 45 min");
    expect(prisma.task.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { dueSoonNotifiedFor: due } });
  });

  it("reminds every assignee", async () => {
    const task = makeTask({ dueDate: dueIn(30), assignees: [{ userId: "e2", user: person("e2") }] });
    const { service, notifications } = makeService([task]);
    await service.checkDueSoonTasks();
    expect(sent(notifications).map((c) => c.userId).sort()).toEqual(["e1", "e2"]);
  });

  it("does not remind twice for the same deadline", async () => {
    const due = dueIn(20);
    const { service, notifications } = makeService([makeTask({ dueDate: due, dueSoonNotifiedFor: due })]);
    await service.checkDueSoonTasks();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it("reminds again after the deadline moves", async () => {
    const { service, notifications } = makeService([
      makeTask({ dueDate: dueIn(20), dueSoonNotifiedFor: dueIn(-100) }),
    ]);
    await service.checkDueSoonTasks();
    expect(notifications.create).toHaveBeenCalledTimes(1);
  });

  it("skips tasks nobody is assigned to", async () => {
    const { service, prisma, notifications } = makeService([
      makeTask({ dueDate: dueIn(20), assigneeId: null, assignee: null }),
    ]);
    await service.checkDueSoonTasks();
    expect(notifications.create).not.toHaveBeenCalled();
    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  it("never reminds Admins/managers (only the person who has to act)", async () => {
    const { service, notifications } = makeService([makeTask({ dueDate: dueIn(20) })]);
    await service.checkDueSoonTasks();
    expect(sent(notifications).map((c) => c.userId)).toEqual(["e1"]);
  });

  it("swallows a top-level failure instead of crashing the scheduler", async () => {
    const { service, prisma } = makeService();
    prisma.task.findMany.mockRejectedValue(new Error("db down"));
    await expect(service.checkDueSoonTasks()).resolves.toBeUndefined();
  });
});
