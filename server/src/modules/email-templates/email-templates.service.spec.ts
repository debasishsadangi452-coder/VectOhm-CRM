import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { EmailTemplatesService } from "./email-templates.service";
import { canEditTemplate, templateVisibleTo } from "./template-visibility";
import type { RequestUser } from "../../common/types/request-user.type";

const user = (id: string, dept: string | null = "Sales", role = "EMPLOYEE"): RequestUser =>
  ({
    id,
    role: { name: role },
    department: dept ? { id: `d-${dept}`, name: dept, managerTitle: "Manager" } : null,
  }) as unknown as RequestUser;

function make(found: unknown = { id: "t1", creatorId: "me" }) {
  const prisma = {
    emailTemplate: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(found),
      create: jest.fn(async ({ data }: any) => ({ id: "new", ...data })),
      update: jest.fn(async ({ data }: any) => ({ id: "t1", ...data })),
      delete: jest.fn().mockResolvedValue({}),
    },
  };
  return { service: new EmailTemplatesService(prisma as never), prisma };
}

describe("template visibility rules", () => {
  it("shows a person their own templates, everything shared with everyone, and their department's", () => {
    expect(templateVisibleTo(user("me"))).toEqual({
      OR: [
        { creatorId: "me" },
        { visibility: "EVERYONE" },
        { visibility: "DEPARTMENT", departmentId: "d-Sales" },
      ],
    });
  });

  it("leaves out department sharing for someone with no department, and shows an Admin everything", () => {
    expect((templateVisibleTo(user("me", null)) as { OR: unknown[] }).OR).toHaveLength(2);
    expect(templateVisibleTo(user("boss", null, "ADMIN"))).toEqual({});
  });

  it("lets only the creator or an Admin edit", () => {
    expect(canEditTemplate({ creatorId: "me" }, user("me"))).toBe(true);
    expect(canEditTemplate({ creatorId: "someone" }, user("me"))).toBe(false);
    expect(canEditTemplate({ creatorId: "someone" }, user("boss", null, "ADMIN"))).toBe(true);
  });
});

describe("EmailTemplatesService", () => {
  it("lists only what the person is allowed to see", async () => {
    const { service, prisma } = make();
    await service.findAll(user("me"));
    expect(prisma.emailTemplate.findMany.mock.calls[0][0].where).toEqual(templateVisibleTo(user("me")));
  });

  it("creates a template private by default, and records an AI-written first draft", async () => {
    const { service, prisma } = make();
    await service.create({ name: "N", subject: "S", bodyHtml: "B" }, user("me"));
    expect(prisma.emailTemplate.create.mock.calls[0][0].data).toMatchObject({
      visibility: "PRIVATE",
      aiGenerated: false,
      creatorId: "me",
      departmentId: "d-Sales",
    });
    await service.create({ name: "N", subject: "S", bodyHtml: "B", visibility: "EVERYONE", aiGenerated: true }, user("me"));
    expect(prisma.emailTemplate.create.mock.calls[1][0].data).toMatchObject({ visibility: "EVERYONE", aiGenerated: true });
  });

  it("cannot share with a department when the person has none (an Admin without one)", async () => {
    const { service } = make();
    await expect(
      service.create({ name: "N", subject: "S", bodyHtml: "B", visibility: "DEPARTMENT" }, user("boss", null, "ADMIN")),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("lets others use a shared template but not change or delete it", async () => {
    const { service, prisma } = make({ id: "t1", creatorId: "someone" });
    await expect(service.update("t1", { name: "Hacked" }, user("me"))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.remove("t1", user("me"))).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.emailTemplate.update).not.toHaveBeenCalled();
    expect(prisma.emailTemplate.delete).not.toHaveBeenCalled();
  });

  it("lets the creator change visibility, and sharing with a department uses their department", async () => {
    const { service, prisma } = make({ id: "t1", creatorId: "me" });
    await service.update("t1", { visibility: "DEPARTMENT" }, user("me"));
    expect(prisma.emailTemplate.update.mock.calls[0][0].data).toMatchObject({ visibility: "DEPARTMENT", departmentId: "d-Sales" });
  });

  it("treats a template the person can't see as not found", async () => {
    const { service } = make(null);
    await expect(service.findOne("t1", user("me"))).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update("t1", { name: "x" }, user("me"))).rejects.toBeInstanceOf(NotFoundException);
  });

  it("is closed to people outside Sales and Recruitment", async () => {
    const { service } = make();
    await expect(service.findAll(user("dev", "Dev"))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
