import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { SprintsService } from "./sprints.service";
import type { RequestUser } from "../../common/types/request-user.type";

function buildPrismaMock() {
  return {
    sprint: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
  };
}

function buildUser(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: "user-1",
    email: "dev@company.com",
    firstName: "Dev",
    lastName: "One",
    role: { id: "role-1", name: RoleName.EMPLOYEE },
    department: { id: "dept-dev", name: "Development", managerTitle: "Dev Lead" },
    ...overrides,
  };
}

const admin = () =>
  buildUser({ id: "admin-1", role: { id: "r-admin", name: RoleName.ADMIN }, department: null });

const devManager = (id = "mgr-dev") =>
  buildUser({
    id,
    role: { id: "r-mgr", name: RoleName.MANAGER },
    department: { id: "dept-dev", name: "Development", managerTitle: "Dev Lead" },
  });

describe("SprintsService - Development Manager Sprint Lifecycle Unit Tests", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: SprintsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = buildPrismaMock();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new SprintsService(prisma as any, { create: jest.fn().mockResolvedValue(undefined) } as any);
  });

  it("Dev Manager creates an ACTIVE sprint and auto-completes previously active sprints", async () => {
    prisma.sprint.updateMany.mockResolvedValue({ count: 1 });
    prisma.sprint.create.mockResolvedValue({
      id: "sprint-1",
      name: "Sprint 42",
      status: "ACTIVE",
      departmentId: "dept-dev",
    });

    const res = await service.create(
      {
        name: "Sprint 42",
        startDate: "2026-10-01",
        endDate: "2026-10-15",
        status: "ACTIVE",
      },
      devManager(),
    );

    expect(prisma.sprint.updateMany).toHaveBeenCalledWith({
      where: { departmentId: "dept-dev", status: "ACTIVE" },
      data: { status: "COMPLETED" },
    });
    expect(res.name).toBe("Sprint 42");
  });

  it("Dev Manager cannot create a sprint for another department (403 Forbidden)", async () => {
    await expect(
      service.create(
        {
          name: "Sprint Sales",
          startDate: "2026-10-01",
          endDate: "2026-10-15",
          status: "PLANNED",
          departmentId: "dept-sales",
        },
        devManager(),
      ),
    ).rejects.toThrow(
      new ForbiddenException("You cannot create a sprint for another department"),
    );
  });
});
