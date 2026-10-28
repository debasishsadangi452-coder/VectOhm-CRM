import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { AttendanceAdjustmentsService } from "./attendance-adjustments.service";
import type { RequestUser } from "../../common/types/request-user.type";

const admin = (id: string, email = "admin@venusglobaltech.com") =>
  ({ id, email, role: { id: "r", name: "ADMIN" } }) as unknown as RequestUser;
const employee = { id: "e1", role: { id: "r", name: "EMPLOYEE" } } as unknown as RequestUser;

const source = {
  userId: "u1",
  date: new Date("2026-10-19T00:00:00Z"),
  clockInAt: new Date("2026-10-19T12:30:00Z"),
  durationMin: 540,
};

function build(request: Record<string, unknown> | null = { id: "a1", userId: "u1", forDate: new Date("2026-10-20T00:00:00Z") }) {
  const prisma = {
    attendanceAdjustmentRequest: {
      findUnique: jest.fn().mockResolvedValue(request),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    workSession: { findFirst: jest.fn().mockResolvedValue(source), create: jest.fn().mockResolvedValue({}) },
  };
  return { prisma, service: new AttendanceAdjustmentsService(prisma as never) };
}

describe("AttendanceAdjustmentsService.decide", () => {
  it("only lets admins decide", async () => {
    const { service } = build();
    await expect(service.decide(employee, "a1", true)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("does not let other admins list or decide", async () => {
    const { service } = build();
    const other = admin("a2", "paresh@venusglobaltech.com");
    await expect(service.list(other)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.decide(other, "a1", true)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("does not let an admin decide their own request", async () => {
    const { service } = build();
    await expect(service.decide(admin("u1"), "a1", true)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("on approval creates a session flagged with the request id, copying the source hours", async () => {
    const { prisma, service } = build();
    await service.decide(admin("boss"), "a1", true);
    const data = prisma.workSession.create.mock.calls[0][0].data;
    expect(data.adjustmentRequestId).toBe("a1");
    expect(data.clockInAt).toEqual(new Date("2026-10-20T12:30:00Z"));
    expect(data.clockOutAt).toEqual(new Date("2026-10-20T21:30:00Z"));
    expect(data.durationMin).toBe(540);
  });

  it("on denial creates no session", async () => {
    const { prisma, service } = build();
    await service.decide(admin("boss"), "a1", false);
    expect(prisma.workSession.create).not.toHaveBeenCalled();
  });

  it("only copies from real sessions, never from earlier adjustments", async () => {
    const { prisma, service } = build();
    await service.decide(admin("boss"), "a1", true);
    expect(prisma.workSession.findFirst.mock.calls[0][0].where.adjustmentRequestId).toBeNull();
  });
});
