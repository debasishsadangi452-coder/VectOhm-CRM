import { RoleName } from "@prisma/client";
import type { RequestUser } from "../common/types/request-user.type";

// Shared across every *.service.spec.ts in the recruitment module (candidates,
// job-postings, clients, vendors, leads, eboarding, offers) so each test only
// has to stub the handful of Prisma calls it actually exercises, instead of
// re-declaring this shape seven times.
export interface MockPrismaModel {
  findMany: jest.Mock;
  findUnique: jest.Mock;
  findUniqueOrThrow: jest.Mock;
  findFirst: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
}

function mockModel(): MockPrismaModel {
  return {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

export function createPrismaMock() {
  return {
    candidate: mockModel(),
    jobPosting: mockModel(),
    client: mockModel(),
    vendor: mockModel(),
    lead: mockModel(),
    eboarding: mockModel(),
    offer: mockModel(),
    // Real PrismaService.$transaction takes an array of prisma promises and
    // resolves them; tests that hit it (OffersService.update) provide their
    // own implementation per-case, this is just a safe default.
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

export type PrismaMock = ReturnType<typeof createPrismaMock>;

const BASE_USER: RequestUser = {
  id: "user-1",
  email: "user@venus.test",
  firstName: "Test",
  lastName: "User",
  role: { id: "role-admin", name: RoleName.ADMIN },
  department: { id: "dept-recruitment", name: "Recruitment", managerTitle: "Recruitment Manager" },
};

export function makeUser(overrides: Partial<RequestUser> = {}): RequestUser {
  return { ...BASE_USER, ...overrides, role: { ...BASE_USER.role, ...overrides.role } };
}

export const ADMIN_USER = makeUser();
export const RECRUITMENT_MANAGER = makeUser({
  id: "manager-1",
  role: { id: "role-manager", name: RoleName.MANAGER },
});
export const RECRUITMENT_EMPLOYEE = makeUser({
  id: "employee-1",
  role: { id: "role-employee", name: RoleName.EMPLOYEE },
});
export const NON_RECRUITMENT_EMPLOYEE = makeUser({
  id: "employee-2",
  role: { id: "role-employee", name: RoleName.EMPLOYEE },
  department: { id: "dept-sales", name: "Sales", managerTitle: "Sales Manager" },
});
