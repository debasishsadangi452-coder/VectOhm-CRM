import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateArticleDto } from "./dto/create-article.dto";
import { UpdateArticleDto } from "./dto/update-article.dto";
import type { RequestUser } from "../../common/types/request-user.type";

const articleInclude = {
  author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  department: { select: { id: true, name: true } },
} as const;

@Injectable()
export class KnowledgeService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(q?: string, category?: string, user?: RequestUser) {
    const isAdmin = user?.role.name === RoleName.ADMIN;
    const departmentId = user?.department?.id;

    // Base scoping rules: Admin sees all. Others see public articles or their own department.
    const where: any = {
      AND: [
        isAdmin
          ? {}
          : {
              OR: [
                { departmentId: null },
                ...(departmentId ? [{ departmentId }] : []),
              ],
            },
      ],
    };

    if (category) {
      where.AND.push({ category });
    }

    if (q) {
      where.AND.push({
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { content: { contains: q, mode: "insensitive" } },
        ],
      });
    }

    return this.prisma.kBArticle.findMany({
      where,
      include: articleInclude,
      orderBy: { updatedAt: "desc" },
    });
  }

  async findOne(id: string, user: RequestUser) {
    const article = await this.prisma.kBArticle.findUnique({
      where: { id },
      include: articleInclude,
    });

    if (!article) {
      throw new NotFoundException("Article not found");
    }

    this.assertCanAccess(article, user);
    return article;
  }

  async create(dto: CreateArticleDto, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    if (dto.departmentId) {
      const isDeptMember = user.department?.id === dto.departmentId;
      if (!isAdmin && !isDeptMember) {
        throw new ForbiddenException("You cannot assign an article to another department");
      }
    }

    return this.prisma.kBArticle.create({
      data: {
        title: dto.title,
        content: dto.content,
        category: dto.category,
        authorId: user.id,
        departmentId: dto.departmentId ?? null,
      },
      include: articleInclude,
    });
  }

  async update(id: string, dto: UpdateArticleDto, user: RequestUser) {
    const article = await this.prisma.kBArticle.findUnique({ where: { id } });
    if (!article) {
      throw new NotFoundException("Article not found");
    }

    this.assertCanMutate(article, user);

    const isAdmin = user.role.name === RoleName.ADMIN;
    if (dto.departmentId) {
      const isDeptMember = user.department?.id === dto.departmentId;
      if (!isAdmin && !isDeptMember) {
        throw new ForbiddenException("You cannot assign an article to another department");
      }
    }

    return this.prisma.kBArticle.update({
      where: { id },
      data: {
        title: dto.title,
        content: dto.content,
        category: dto.category,
        departmentId: dto.departmentId,
      },
      include: articleInclude,
    });
  }

  async remove(id: string, user: RequestUser) {
    const article = await this.prisma.kBArticle.findUnique({ where: { id } });
    if (!article) {
      throw new NotFoundException("Article not found");
    }

    this.assertCanMutate(article, user);

    await this.prisma.kBArticle.delete({ where: { id } });
  }

  private assertCanAccess(article: { departmentId: string | null }, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    if (article.departmentId) {
      const isDeptMember = user.department?.id === article.departmentId;
      if (!isAdmin && !isDeptMember) {
        throw new ForbiddenException("You do not have permission to view this article");
      }
    }
  }

  private assertCanMutate(
    article: { authorId: string; departmentId: string | null },
    user: RequestUser,
  ) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const isAuthor = article.authorId === user.id;
    const isDeptManager =
      user.role.name === RoleName.MANAGER &&
      (article.departmentId === null || article.departmentId === user.department?.id);

    if (!isAdmin && !isAuthor && !isDeptManager) {
      throw new ForbiddenException("You do not have permission to modify this article");
    }
  }
}
