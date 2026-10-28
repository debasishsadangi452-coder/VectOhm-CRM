import { NotificationType } from "@prisma/client";
import { ActivityMonitoringService } from "./activity-monitoring.service";
import type { RequestUser } from "../../common/types/request-user.type";

const user = {
  id: "emp1",
  email: "emp@x.com",
  firstName: "Eve",
  lastName: "Employee",
  role: { id: "r", name: "EMPLOYEE" },
  department: { id: "d1", name: "Recruitment", managerTitle: "Manager" },
} as unknown as RequestUser;

const person = (id: string, role: string, department: string | null) => ({
  id,
  role: { name: role },
  department: department ? { name: department } : null,
});

function makeService(opts: { active?: unknown; recipients?: unknown[]; recent?: unknown } = {}) {
  const prisma = {
    notification: { findFirst: jest.fn().mockResolvedValue(opts.recent ?? null) },
    user: {
      findMany: jest.fn().mockResolvedValue(
        opts.recipients ?? [person("admin1", "ADMIN", "Executive"), person("hr1", "EMPLOYEE", "HR")],
      ),
    },
  };
  const workSessions = {
    getActive: jest.fn().mockResolvedValue("active" in opts ? opts.active : { id: "s1", isOnBreak: false }),
  };
  const notifications = { create: jest.fn().mockResolvedValue({}) };
  const service = new ActivityMonitoringService(
    prisma as never,
    workSessions as never,
    notifications as never,
    { getActiveGapSec: jest.fn().mockResolvedValue(3600) } as never,
  );
  return { service, prisma, workSessions, notifications };
}

const sent = (n: { create: jest.Mock }) => n.create.mock.calls.map(([c]) => c);

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-10-05T06:00:00Z"));
});
afterEach(() => jest.useRealTimers());

describe("ActivityMonitoringService.reportAgentQuit", () => {
  it("still notifies when the employee is not clocked in (recording is always on)", async () => {
    const { service, notifications } = makeService({ active: null });
    await expect(service.reportAgentQuit(user)).resolves.toEqual({ notified: true });
    expect(sent(notifications).map((c) => c.userId)).toEqual(["admin1", "hr1"]);
    for (const n of sent(notifications)) {
      expect(n.message).toContain("Eve Employee quit the Venus CRM desktop agent.");
      expect(n.message).not.toContain("while clocked in");
    }
  });

  it("notifies every Admin and HR user that the employee quit while clocked in", async () => {
    const { service, notifications } = makeService();
    await expect(service.reportAgentQuit(user)).resolves.toEqual({ notified: true });

    expect(sent(notifications).map((c) => c.userId)).toEqual(["admin1", "hr1"]);
    for (const n of sent(notifications)) {
      expect(n).toMatchObject({
        type: NotificationType.AGENT_QUIT,
        title: "🛑 Desktop agent quit",
        link: "/screen-monitoring?userId=emp1",
      });
      expect(n.message).toContain("Eve Employee quit the Venus CRM desktop agent while clocked in");
      expect(n.message).toContain("Screen recording is stopped");
    }
  });

  it("says so when they were on a break", async () => {
    const { service, notifications } = makeService({ active: { id: "s1", isOnBreak: true } });
    await service.reportAgentQuit(user);
    expect(sent(notifications)[0].message).toContain("(on break)");
  });

  it("never notifies the person who quit, and only asks for active Admin/HR users", async () => {
    const { service, prisma } = makeService();
    await service.reportAgentQuit(user);

    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.isActive).toBe(true);
    expect(where.id).toEqual({ not: "emp1" });
    expect(JSON.stringify(where.OR)).toContain("ADMIN");
  });

  it("only HR departments count: a department that merely contains 'hr' is not swept in", async () => {
    const { service, notifications } = makeService({
      recipients: [
        person("admin1", "ADMIN", null),
        person("hr1", "EMPLOYEE", "Human Resources"),
        person("hr2", "MANAGER", "HR"),
        person("nope1", "EMPLOYEE", "Shrewsbury Sales"), // contains "hr" -- must be excluded
        person("nope2", "MANAGER", "Threshold Ops"), // contains "hr" -- must be excluded
      ],
    });
    await service.reportAgentQuit(user);
    expect(sent(notifications).map((c) => c.userId).sort()).toEqual(["admin1", "hr1", "hr2"]);
  });

  it("drops a repeat report for the same person within two minutes", async () => {
    const { service, prisma, notifications } = makeService({ recent: { id: "n1" } });
    await expect(service.reportAgentQuit(user)).resolves.toEqual({ notified: false });
    expect(notifications.create).not.toHaveBeenCalled();

    const where = prisma.notification.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ type: NotificationType.AGENT_QUIT, link: "/screen-monitoring?userId=emp1" });
    expect(where.createdAt.gte).toEqual(new Date("2026-10-05T05:58:00Z"));
  });

  it("one failed delivery doesn't stop the rest, and the call still succeeds", async () => {
    const { service, notifications } = makeService();
    notifications.create.mockRejectedValueOnce(new Error("socket down"));
    await expect(service.reportAgentQuit(user)).resolves.toEqual({ notified: true });
    expect(notifications.create).toHaveBeenCalledTimes(2);
  });

  it("reports notified:false when nobody could be notified", async () => {
    const none = makeService({ recipients: [] });
    await expect(none.service.reportAgentQuit(user)).resolves.toEqual({ notified: false });

    const allFail = makeService();
    allFail.notifications.create.mockRejectedValue(new Error("down"));
    await expect(allFail.service.reportAgentQuit(user)).resolves.toEqual({ notified: false });
  });
});
