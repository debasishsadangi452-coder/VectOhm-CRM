import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { EmailTemplateVisibility } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateEmailTemplateDto } from "./dto/create-email-template.dto";
import { UpdateEmailTemplateDto } from "./dto/update-email-template.dto";
import { canUseSalesOrRecruitment } from "../../common/utils/sales-access";
import { canEditTemplate, templateVisibleTo } from "./template-visibility";
import type { RequestUser } from "../../common/types/request-user.type";

const templateInclude = {
  creator: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
} as const;

@Injectable()
export class EmailTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  // Your own templates, plus whatever others shared with everyone or with your department.
  async findAll(user: RequestUser) {
    this.assertCanUse(user);
    return this.prisma.emailTemplate.findMany({
      where: templateVisibleTo(user),
      include: templateInclude,
      orderBy: { updatedAt: "desc" },
    });
  }

  async findOne(id: string, user: RequestUser) {
    this.assertCanUse(user);
    const template = await this.prisma.emailTemplate.findFirst({
      where: { id, ...templateVisibleTo(user) },
      include: templateInclude,
    });
    if (!template) {
      throw new NotFoundException("Email template not found");
    }
    return template;
  }

  async create(dto: CreateEmailTemplateDto, user: RequestUser) {
    this.assertCanUse(user);
    const visibility = dto.visibility ?? EmailTemplateVisibility.PRIVATE;
    this.assertCanShareWith(visibility, user);
    return this.prisma.emailTemplate.create({
      data: {
        name: dto.name,
        subject: dto.subject,
        bodyHtml: dto.bodyHtml,
        appendSignature: dto.appendSignature,
        visibility,
        aiGenerated: dto.aiGenerated ?? false,
        creatorId: user.id,
        departmentId: user.department?.id,
      },
      include: templateInclude,
    });
  }

  async update(id: string, dto: UpdateEmailTemplateDto, user: RequestUser) {
    this.assertCanUse(user);
    await this.getEditable(id, user);
    if (dto.visibility !== undefined) this.assertCanShareWith(dto.visibility, user);
    return this.prisma.emailTemplate.update({
      where: { id },
      data: {
        name: dto.name,
        subject: dto.subject,
        bodyHtml: dto.bodyHtml,
        appendSignature: dto.appendSignature,
        visibility: dto.visibility,
        // Sharing with a department means the creator's *current* department.
        ...(dto.visibility === EmailTemplateVisibility.DEPARTMENT && user.department
          ? { departmentId: user.department.id }
          : {}),
        ...(dto.aiGenerated !== undefined ? { aiGenerated: dto.aiGenerated } : {}),
      },
      include: templateInclude,
    });
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    this.assertCanUse(user);
    await this.getEditable(id, user);
    await this.prisma.emailTemplate.delete({ where: { id } });
  }

  // Others can use a shared template but not change or delete it -- they can copy it into their own.
  private async getEditable(id: string, user: RequestUser) {
    const template = await this.prisma.emailTemplate.findFirst({
      where: { id, ...templateVisibleTo(user) },
    });
    if (!template) {
      throw new NotFoundException("Email template not found");
    }
    if (!canEditTemplate(template, user)) {
      throw new ForbiddenException("Only the person who made this template (or an Admin) can change or delete it.");
    }
    return template;
  }

  private assertCanShareWith(visibility: EmailTemplateVisibility, user: RequestUser) {
    if (visibility === EmailTemplateVisibility.DEPARTMENT && !user.department) {
      throw new BadRequestException("You are not in a department, so there is no department to share this with.");
    }
  }

  // Sales and Recruitment people use templates; what each person sees is narrowed by templateVisibleTo.
  private assertCanUse(user: RequestUser) {
    if (!canUseSalesOrRecruitment(user)) {
      throw new ForbiddenException("Email templates are only available to the Sales and Recruitment departments");
    }
  }
}
