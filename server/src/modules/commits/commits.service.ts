import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateCommitDto } from "./dto/create-commit.dto";
import type { RequestUser } from "../../common/types/request-user.type";

@Injectable()
export class CommitsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;

    // Same rationale as TasksService.visibilityScope -- a non-Admin only
    // sees commits from authors in their own department (fail closed: a
    // user with no department sees only other departmentless authors, not
    // everyone).
    const where: any = {};
    if (!isAdmin) {
      where.author = { departmentId: user.department?.id ?? null };
    }

    return this.prisma.gitCommit.findMany({
      where,
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        task: { select: { id: true, title: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async create(dto: CreateCommitDto, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const departmentId = user.department?.id;

    // Verify developer exists
    const author = await this.prisma.user.findUnique({
      where: { id: dto.authorId },
      include: { department: true },
    });

    if (!author) {
      throw new NotFoundException("Developer / Author not found");
    }

    // Verify department constraints
    if (!isAdmin && author.departmentId !== departmentId) {
      throw new ForbiddenException("You cannot record commits for developers outside your department");
    }

    // Verify task exists if provided
    if (dto.taskId) {
      const task = await this.prisma.task.findUnique({ where: { id: dto.taskId } });
      if (!task) {
        throw new NotFoundException("Linked task not found");
      }
      if (!isAdmin && task.departmentId !== departmentId) {
        throw new ForbiddenException("You cannot link a commit to a task outside your department");
      }

      // Automatically move task if requested
      if (dto.moveTaskTo) {
        await this.prisma.task.update({
          where: { id: dto.taskId },
          data: { status: dto.moveTaskTo },
        });
      }
    }

    // Generate a random 8-character hex hash (hash is @unique in the schema).
    const hash = randomBytes(4).toString("hex");

    let prNumber: number | null = null;
    if (dto.isPR) {
      const prCount = await this.prisma.gitCommit.count({ where: { isPR: true } });
      prNumber = prCount + 1;
    }

    return this.prisma.gitCommit.create({
      data: {
        hash,
        message: dto.message,
        branch: dto.branch ?? "main",
        authorId: dto.authorId,
        taskId: dto.taskId ?? null,
        isPR: dto.isPR ?? false,
        prStatus: dto.isPR ? "OPEN" : null,
        prNumber,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        task: { select: { id: true, title: true, status: true } },
      },
    });
  }

  async mergePR(id: string, user: RequestUser) {
    const pr = await this.prisma.gitCommit.findUnique({
      where: { id },
      include: { author: true },
    });

    if (!pr || !pr.isPR) {
      throw new NotFoundException("PR not found");
    }

    if (pr.prStatus !== "OPEN") {
      throw new ForbiddenException("This PR is already processed");
    }

    const isAdmin = user.role.name === RoleName.ADMIN;
    // Same-department Manager, not a hardcoded "Dev" department name match --
    // works correctly regardless of what a department is named or renamed to.
    const isDeptManager = user.role.name === RoleName.MANAGER && pr.author.departmentId === user.department?.id;

    if (!isAdmin && !isDeptManager) {
      throw new ForbiddenException("Only the author's department Manager or Admin can merge PRs");
    }

    // Move linked task to DONE if present
    if (pr.taskId) {
      await this.prisma.task.update({
        where: { id: pr.taskId },
        data: { status: "DONE" },
      });
    }

    return this.prisma.gitCommit.update({
      where: { id },
      data: { prStatus: "MERGED" },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        task: { select: { id: true, title: true, status: true } },
      },
    });
  }

  async declinePR(id: string, user: RequestUser) {
    const pr = await this.prisma.gitCommit.findUnique({
      where: { id },
      include: { author: true },
    });

    if (!pr || !pr.isPR) {
      throw new NotFoundException("PR not found");
    }

    if (pr.prStatus !== "OPEN") {
      throw new ForbiddenException("This PR is already processed");
    }

    const isAdmin = user.role.name === RoleName.ADMIN;
    const isDeptManager = user.role.name === RoleName.MANAGER && pr.author.departmentId === user.department?.id;

    if (!isAdmin && !isDeptManager) {
      throw new ForbiddenException("Only the author's department Manager or Admin can decline PRs");
    }

    return this.prisma.gitCommit.update({
      where: { id },
      data: { prStatus: "CLOSED" },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        task: { select: { id: true, title: true, status: true } },
      },
    });
  }
}
