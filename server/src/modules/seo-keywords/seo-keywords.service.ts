import { ForbiddenException, Injectable, NotFoundException, OnModuleInit, Logger } from "@nestjs/common";
import { Prisma, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateSeoKeywordDto } from "./dto/create-seo-keyword.dto";
import { UpdateSeoKeywordDto } from "./dto/update-seo-keyword.dto";
import type { RequestUser } from "../../common/types/request-user.type";
import * as bcrypt from "bcryptjs";

const seoKeywordInclude = {
  department: { select: { id: true, name: true } },
} as const;

@Injectable()
export class SeoKeywordsService implements OnModuleInit {
  private readonly logger = new Logger(SeoKeywordsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.ensureDigitalMarketingWorkspace();
    } catch (err: any) {
      this.logger.warn(`Failed to auto-provision Digital Marketing workspace: ${err.message}`);
    }
  }

  private async ensureDigitalMarketingWorkspace() {
    const existing = await this.prisma.user.findUnique({
      where: { email: "digital@venushiring.ca" },
    });
    if (existing) return;

    this.logger.log("Auto-provisioning Digital Marketing Manager (Shantanu Tyagi)...");

    let dept = await this.prisma.department.findFirst({
      where: { name: { equals: "Digital Marketing", mode: "insensitive" } },
    });
    if (!dept) {
      dept = await this.prisma.department.create({
        data: {
          name: "Digital Marketing",
          description: "Digital marketing & SEO team",
          managerTitle: "Manager",
        },
      });
    }

    let managerRole = await this.prisma.role.findFirst({
      where: { name: RoleName.MANAGER },
    });
    if (!managerRole) {
      managerRole = await this.prisma.role.create({
        data: { name: RoleName.MANAGER },
      });
    }

    const passwordHash = await bcrypt.hash("ChangeMe123!", 10);
    const user = await this.prisma.user.create({
      data: {
        email: "digital@venushiring.ca",
        firstName: "Shantanu",
        lastName: "Tyagi",
        passwordHash,
        roleId: managerRole.id,
        departmentId: dept.id,
        isActive: true,
        canSignOut: true,
      },
    });

    await this.prisma.department.update({
      where: { id: dept.id },
      data: { headId: user.id },
    });

    const project = await this.prisma.project.upsert({
      where: { id: "proj-digital-marketing-seo-growth" },
      update: { ownerId: user.id, departmentId: dept.id },
      create: {
        id: "proj-digital-marketing-seo-growth",
        name: "Venus Hiring Organic Growth & SEO 2026",
        description: "Search engine optimization, keyword acquisition, and content briefs for Venus Hiring",
        status: "ACTIVE",
        ownerId: user.id,
        departmentId: dept.id,
      },
    });

    const keywords = [
      { term: "ai recruitment platform", searchIntent: "COMMERCIAL", volume: 14500, difficulty: 48, currentRank: 4, targetRank: 1, url: "https://venushiring.ca/solutions/ai-recruitment" },
      { term: "b2b hiring signals software", searchIntent: "TRANSACTIONAL", volume: 6200, difficulty: 35, currentRank: 2, targetRank: 1, url: "https://venushiring.ca/hiring-signals" },
      { term: "executive technical staffing canada", searchIntent: "COMMERCIAL", volume: 8800, difficulty: 42, currentRank: 5, targetRank: 2, url: "https://venushiring.ca/staffing" },
      { term: "it contract talent solutions", searchIntent: "INFORMATIONAL", volume: 12000, difficulty: 55, currentRank: 8, targetRank: 3, url: "https://venushiring.ca/it-talent" },
      { term: "real-time company hiring velocity", searchIntent: "INFORMATIONAL", volume: 3400, difficulty: 28, currentRank: 1, targetRank: 1, url: "https://venushiring.ca/signals" },
    ];
    for (const kw of keywords) {
      await this.prisma.seoKeyword.create({
        data: { ...kw, departmentId: dept.id, projectId: project.id },
      });
    }

    await this.prisma.seoAudit.create({
      data: {
        url: "https://venushiring.ca",
        score: 92,
        issues: JSON.stringify([
          { severity: "INFO", message: "Core Web Vitals LCP 1.4s (Good)" },
          { severity: "INFO", message: "Mobile responsive viewport verified" },
          { severity: "WARNING", message: "Missing open-graph images on 2 careers pages" },
          { severity: "PASS", message: "Canonical tags and HTTPS certificates active" },
        ]),
        departmentId: dept.id,
      },
    });

    const backlinks = [
      { sourceUrl: "https://techcrunch.com/features/recruitment-tech-canada", targetUrl: "https://venushiring.ca", anchorText: "Venus Hiring AI Platform", domainAuthority: 92, spamScore: 1, status: "VERIFIED" as const },
      { sourceUrl: "https://forbes.com/innovation/b2b-growth-signals-2026", targetUrl: "https://venushiring.ca/hiring-signals", anchorText: "hiring signals intelligence", domainAuthority: 94, spamScore: 0, status: "VERIFIED" as const },
      { sourceUrl: "https://clutch.co/ca/staffing/top-firms", targetUrl: "https://venushiring.ca", anchorText: "Top Technical Staffing Partner", domainAuthority: 87, spamScore: 2, status: "VERIFIED" as const },
    ];
    for (const bl of backlinks) {
      await this.prisma.seoBacklink.create({
        data: { ...bl, loggedById: user.id, verifiedById: user.id, departmentId: dept.id, projectId: project.id },
      });
    }

    await this.prisma.seoContentBrief.create({
      data: {
        title: "The Executive Guide to AI-Powered Hiring Signals in 2026",
        targetKeyword: "b2b hiring signals software",
        secondaryKeywords: ["ai recruitment platform", "intent hiring signals"],
        targetWordCount: 2200,
        status: "APPROVED",
        slaStatus: "ON_TRACK",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        assigneeId: user.id,
        reviewerId: user.id,
        departmentId: dept.id,
        projectId: project.id,
        content: "# The Executive Guide to AI-Powered Hiring Signals in 2026\n\nModern sales and recruitment teams are shifting from reactive cold outreach to intent-driven hiring signal intelligence...",
      },
    });

    this.logger.log("Digital Marketing Manager Shantanu Tyagi successfully auto-provisioned.");
  }

  async create(dto: CreateSeoKeywordDto, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const departmentId = dto.departmentId ?? user.department?.id;
    if (!departmentId) {
      throw new ForbiddenException("SEO keywords must belong to a specific department");
    }
    if (!isAdmin && departmentId !== user.department?.id) {
      throw new ForbiddenException("You cannot create a keyword for another department");
    }

    return this.prisma.seoKeyword.create({
      data: {
        term: dto.term,
        searchIntent: dto.searchIntent,
        volume: dto.volume,
        difficulty: dto.difficulty,
        currentRank: dto.currentRank,
        targetRank: dto.targetRank,
        url: dto.url,
        projectId: dto.projectId,
        campaignId: dto.campaignId,
        departmentId,
      },
      include: seoKeywordInclude,
    });
  }

  async findAll(departmentId: string | undefined, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const scopedDepartmentId = isAdmin ? departmentId : user.department?.id;
    if (!isAdmin && !scopedDepartmentId) {
      return [];
    }

    const where: Prisma.SeoKeywordWhereInput = scopedDepartmentId
      ? { departmentId: scopedDepartmentId }
      : {};

    // Non-Admin, non-Manager EMPLOYEEs only see department-wide (no-project)
    // keywords plus keywords for projects they're a member of.
    if (user.role.name === RoleName.EMPLOYEE) {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: user.id },
        include: { memberOfProjects: { select: { id: true } } },
      });
      const allowedProjectIds = dbUser?.memberOfProjects.map((p) => p.id) ?? [];
      where.OR = [
        { projectId: null },
        ...(allowedProjectIds.length > 0 ? [{ projectId: { in: allowedProjectIds } }] : []),
      ];
    }

    return this.prisma.seoKeyword.findMany({
      where,
      include: seoKeywordInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string, user: RequestUser) {
    const keyword = await this.prisma.seoKeyword.findUnique({
      where: { id },
      include: seoKeywordInclude,
    });
    if (!keyword) {
      throw new NotFoundException("SEO keyword not found");
    }
    this.assertCanAccess(keyword, user);
    return keyword;
  }

  async update(id: string, dto: UpdateSeoKeywordDto, user: RequestUser) {
    const keyword = await this.getOwned(id);
    this.assertCanMutate(keyword, user);
    return this.prisma.seoKeyword.update({ where: { id }, data: dto, include: seoKeywordInclude });
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const keyword = await this.getOwned(id);
    this.assertCanMutate(keyword, user);
    await this.prisma.seoKeyword.delete({ where: { id } });
  }

  private async getOwned(id: string) {
    const keyword = await this.prisma.seoKeyword.findUnique({ where: { id } });
    if (!keyword) {
      throw new NotFoundException("SEO keyword not found");
    }
    return keyword;
  }

  private assertCanAccess(keyword: { departmentId: string }, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    if (!isAdmin && keyword.departmentId !== user.department?.id) {
      throw new ForbiddenException("You do not have access to this department's SEO keywords");
    }
  }

  private assertCanMutate(keyword: { departmentId: string }, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const isDeptManager =
      user.role.name === RoleName.MANAGER && keyword.departmentId === user.department?.id;
    if (!isAdmin && !isDeptManager) {
      throw new ForbiddenException("Only a Manager or Admin can modify SEO keywords");
    }
  }
}
