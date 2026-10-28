import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ContentBriefStatus, RoleName } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateSeoContentBriefDto } from "./dto/create-seo-content-brief.dto";
import { UpdateSeoContentBriefDto } from "./dto/update-seo-content-brief.dto";
import { CreateContentBriefQaCheckDto } from "./dto/create-content-brief-qa-check.dto";
import { UpdateContentBriefQaCheckDto } from "./dto/update-content-brief-qa-check.dto";
import type { RequestUser } from "../../common/types/request-user.type";

const briefInclude = {
  assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  reviewer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  department: { select: { id: true, name: true } },
  qaChecklist: { orderBy: { createdAt: "asc" as const } },
  performance: true,
} as const;

@Injectable()
export class SeoContentBriefsService {
  private readonly logger = new Logger(SeoContentBriefsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSeoContentBriefDto, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const departmentId = dto.departmentId ?? user.department?.id;
    if (!departmentId) {
      throw new ForbiddenException("Content briefs must belong to a specific department");
    }
    if (!isAdmin && departmentId !== user.department?.id) {
      throw new ForbiddenException("You cannot create a brief for another department");
    }

    return this.prisma.seoContentBrief.create({
      data: {
        title: dto.title,
        targetKeyword: dto.targetKeyword,
        secondaryKeywords: dto.secondaryKeywords,
        targetWordCount: dto.targetWordCount,
        outlineJson: dto.outlineJson,
        status: dto.status,
        slaStatus: dto.slaStatus,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        publishDate: dto.publishDate ? new Date(dto.publishDate) : undefined,
        projectId: dto.projectId,
        campaignId: dto.campaignId,
        assigneeId: dto.assigneeId,
        reviewerId: dto.reviewerId,
        content: dto.content,
        rejectionReason: dto.rejectionReason,
        departmentId,
      },
      include: briefInclude,
    });
  }

  findAll(departmentId: string | undefined, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const scopedDepartmentId = isAdmin ? departmentId : user.department?.id;
    if (!isAdmin && !scopedDepartmentId) {
      return [];
    }
    return this.prisma.seoContentBrief.findMany({
      where: scopedDepartmentId ? { departmentId: scopedDepartmentId } : undefined,
      include: briefInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string, user: RequestUser) {
    const brief = await this.prisma.seoContentBrief.findUnique({
      where: { id },
      include: briefInclude,
    });
    if (!brief) {
      throw new NotFoundException("Content brief not found");
    }
    this.assertCanAccess(brief, user);
    return brief;
  }

  async generateDraft(id: string, user: RequestUser) {
    const brief = await this.getOwned(id);
    this.assertCanMutate(brief, user);

    if (brief.status !== ContentBriefStatus.DRAFT) {
      throw new ForbiddenException("Only a brief still in DRAFT can have a draft generated");
    }

    let content = "";

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      try {
        const anthropic = new Anthropic({ apiKey });
        const response = await anthropic.messages.create({
          model: "claude-3-haiku-20240307",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: `You are an expert SEO Content Writer. Write a comprehensive content brief and outline for the topic "${brief.title}" targeting the keyword "${brief.targetKeyword}". Format the response in Markdown. Include Introduction, Key Sections, and Conclusion.`,
            },
          ],
        });

        const block = response.content[0];
        content = block.type === "text" ? block.text : "Failed to generate text content.";
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to generate draft with Claude: ${message}`);
        content = `# AI Generation Failed\n\nError: ${message}`;
      }
    } else {
      content = `# Simulated AI Draft for: ${brief.title}\n\nThis is an auto-generated draft based on the target keyword **${brief.targetKeyword}**. (ANTHROPIC_API_KEY not found)\n\n## Introduction\nIn today's fast-paced digital world, leveraging the right tools for ${brief.targetKeyword} is crucial for success.\n\n## Key Benefits\n1. Enhanced efficiency\n2. Better ROI\n3. Scalable growth\n\n## Conclusion\nBy focusing on ${brief.targetKeyword}, your business can unlock new potential.`;
    }

    return this.prisma.seoContentBrief.update({
      where: { id },
      data: { status: ContentBriefStatus.IN_PROGRESS, content },
      include: briefInclude,
    });
  }

  async update(id: string, dto: UpdateSeoContentBriefDto, user: RequestUser) {
    const brief = await this.getOwned(id);
    this.assertCanMutate(brief, user);
    return this.prisma.seoContentBrief.update({
      where: { id },
      data: {
        title: dto.title,
        targetKeyword: dto.targetKeyword,
        secondaryKeywords: dto.secondaryKeywords,
        targetWordCount: dto.targetWordCount,
        outlineJson: dto.outlineJson,
        status: dto.status,
        slaStatus: dto.slaStatus,
        dueDate: dto.dueDate === undefined ? undefined : dto.dueDate ? new Date(dto.dueDate) : null,
        publishDate:
          dto.publishDate === undefined
            ? undefined
            : dto.publishDate
              ? new Date(dto.publishDate)
              : null,
        projectId: dto.projectId,
        campaignId: dto.campaignId,
        assigneeId: dto.assigneeId,
        reviewerId: dto.reviewerId,
        content: dto.content,
        rejectionReason: dto.rejectionReason,
      },
      include: briefInclude,
    });
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const brief = await this.getOwned(id);
    this.assertCanMutate(brief, user);
    await this.prisma.seoContentBrief.delete({ where: { id } });
  }

  async addQaCheck(briefId: string, dto: CreateContentBriefQaCheckDto, user: RequestUser) {
    const brief = await this.getOwned(briefId);
    this.assertCanMutate(brief, user);
    return this.prisma.contentBriefQaCheck.create({
      data: { briefId, checkItem: dto.checkItem },
    });
  }

  async toggleQaCheck(checkId: string, dto: UpdateContentBriefQaCheckDto, user: RequestUser) {
    const check = await this.prisma.contentBriefQaCheck.findUnique({ where: { id: checkId } });
    if (!check) {
      throw new NotFoundException("QA checklist item not found");
    }
    const brief = await this.getOwned(check.briefId);
    this.assertCanMutate(brief, user);
    return this.prisma.contentBriefQaCheck.update({
      where: { id: checkId },
      data: { isPassed: dto.isPassed, verifiedById: dto.isPassed ? user.id : null },
    });
  }

  async removeQaCheck(checkId: string, user: RequestUser): Promise<void> {
    const check = await this.prisma.contentBriefQaCheck.findUnique({ where: { id: checkId } });
    if (!check) {
      throw new NotFoundException("QA checklist item not found");
    }
    const brief = await this.getOwned(check.briefId);
    this.assertCanMutate(brief, user);
    await this.prisma.contentBriefQaCheck.delete({ where: { id: checkId } });
  }

  private async getOwned(id: string) {
    const brief = await this.prisma.seoContentBrief.findUnique({ where: { id } });
    if (!brief) {
      throw new NotFoundException("Content brief not found");
    }
    return brief;
  }

  private assertCanAccess(brief: { departmentId: string }, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    if (!isAdmin && brief.departmentId !== user.department?.id) {
      throw new ForbiddenException("You do not have access to this department's content briefs");
    }
  }

  // Wider than the other SEO modules' assertCanMutate: the assignee is the
  // person actually doing the writing, so they can update their own brief
  // (status/content) without needing Manager/Admin sign-off for every edit.
  private assertCanMutate(
    brief: { departmentId: string; assigneeId: string | null },
    user: RequestUser,
  ) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const isAssignee = brief.assigneeId === user.id;
    const isDeptManager =
      user.role.name === RoleName.MANAGER && brief.departmentId === user.department?.id;
    if (!isAdmin && !isAssignee && !isDeptManager) {
      throw new ForbiddenException(
        "Only the assignee, a Manager, or an Admin can modify this brief",
      );
    }
  }
}
