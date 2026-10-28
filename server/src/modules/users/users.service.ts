import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, StreamableFile } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type { Response } from "express";
import { Prisma, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { canManageDirectory } from "../../common/utils/directory-access";
import { sanitizeModules } from "../../common/utils/modules";
import type { RequestUser } from "../../common/types/request-user.type";

const AVATARS_ROOT = join(process.cwd(), "storage", "avatars");

function safeAvatarExtension(originalName: string): string {
  const ext = extname(originalName).toLowerCase();
  return /^\.(png|jpg|jpeg|gif|webp)$/.test(ext) ? ext : ".png";
}

// Mirrors auth.service.ts's normalizeEmail -- keeps stored emails
// consistent with how login looks them up.
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  githubUsername: true,
  isActive: true,
  screenRecordingEnabled: true,
  canSignOut: true,
  modulesCustomized: true,
  modules: true,
  monthlyTarget: true,
  shiftStart: true,
  shiftEnd: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { id: true, name: true } },
  department: { select: { id: true, name: true, managerTitle: true } },
  manager: { select: { id: true, firstName: true, lastName: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(departmentId?: string, user?: RequestUser) {
    const where: Record<string, unknown> = {};
    if (departmentId) {
      where.departmentId = departmentId;
    }
    return this.prisma
      .user.findMany({ where, select: userSelect, orderBy: { createdAt: "desc" } })
      .then((rows) => rows.map((row) => this.redactFor(row, user)));
  }

  async findOne(id: string, viewer?: RequestUser) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: userSelect });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return this.redactFor(user, viewer);
  }

  // The directory is open to every logged-in user (assignee pickers), but
  // other people's sales target and working hours are only for Admin, HR and
  // Managers. Everyone still sees their own.
  private redactFor<T extends { id: string; monthlyTarget: unknown; shiftStart: unknown; shiftEnd: unknown }>(
    row: T,
    viewer?: RequestUser,
  ): T {
    if (!viewer || viewer.id === row.id || viewer.role.name === RoleName.MANAGER || canManageDirectory(viewer)) {
      return row;
    }
    return { ...row, monthlyTarget: null, shiftStart: null, shiftEnd: null };
  }

  async create(dto: CreateUserDto, actor: RequestUser) {
    this.assertCanManageDirectory(actor);
    // Only a real Admin may mint another Admin -- HR can onboard/manage
    // Managers and Employees, but must not be able to escalate to Admin.
    this.assertNotGrantingAdmin(actor, dto.role);

    // Normalize casing before both the uniqueness check and the insert --
    // login does a case-insensitive-normalized lookup (see auth.service.ts),
    // so a stored "John@x.com" next to an existing "john@x.com" would create
    // two accounts that look identical to whoever's trying to log into
    // either of them.
    const email = normalizeEmail(dto.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException("Email already in use");
    }
    if (dto.departmentId) {
      await this.assertDepartmentExists(dto.departmentId);
    }
    if (dto.managerId) {
      await this.assertUserExists(dto.managerId);
    }

    const moduleAccess = this.resolveModuleAccess(dto, actor, { modulesCustomized: false });

    const role = await this.prisma.role.findUniqueOrThrow({ where: { name: dto.role } });
    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        ...moduleAccess,
        email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        avatarUrl: dto.avatarUrl,
        githubUsername: dto.githubUsername,
        roleId: role.id,
        departmentId: dto.departmentId,
        managerId: dto.managerId,
        monthlyTarget: dto.monthlyTarget,
        shiftStart: dto.shiftStart,
        shiftEnd: dto.shiftEnd,
      },
      select: userSelect,
    });
  }

  // Self-service profile edit -- a user updating their OWN name/avatar only.
  // Email (login identifier) is never changeable; password goes through the
  // emailed reset-link flow, not here.
  async updateOwnProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        avatarUrl: dto.avatarUrl,
      },
      select: userSelect,
    });
  }

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("No image file provided");
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    await mkdir(AVATARS_ROOT, { recursive: true });
    const ext = safeAvatarExtension(file.originalname || "avatar.png");
    const filename = `${userId}-${Date.now()}${ext}`;
    const filePath = join(AVATARS_ROOT, filename);

    await writeFile(filePath, file.buffer);

    const avatarUrl = `/api/users/avatar/${filename}`;
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: userSelect,
    });
  }

  async streamAvatar(filename: string, res: Response): Promise<StreamableFile> {
    const cleanFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, "");
    const filePath = join(AVATARS_ROOT, cleanFilename);
    try {
      await stat(filePath);
    } catch {
      throw new NotFoundException("Avatar not found");
    }

    const ext = extname(cleanFilename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
    };
    const contentType = mimeTypes[ext] || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");

    const fileStream = createReadStream(filePath);
    return new StreamableFile(fileStream);
  }

  async update(id: string, dto: UpdateUserDto, actor: RequestUser) {
    this.assertCanManageDirectory(actor);
    const target = await this.findOne(id);
    // A non-Admin directory manager (HR) can't touch an existing Admin, nor
    // promote anyone to Admin.
    if (actor.role.name !== RoleName.ADMIN && target.role.name === RoleName.ADMIN) {
      throw new ForbiddenException("Only an admin can modify an admin account");
    }
    this.assertNotGrantingAdmin(actor, dto.role);
    // HR can edit people, but only an Admin decides who is screen-recorded.
    if (dto.canSignOut !== undefined && actor.role.name !== RoleName.ADMIN) {
      throw new ForbiddenException("Only an admin can allow someone to sign out");
    }
    if (dto.screenRecordingEnabled !== undefined && actor.role.name !== RoleName.ADMIN) {
      throw new ForbiddenException("Only an admin can turn screen recording on or off");
    }
    const moduleAccess = this.resolveModuleAccess(dto, actor, target);
    if (
      target.role.name === RoleName.ADMIN &&
      (dto.isActive === false || (dto.role !== undefined && dto.role !== RoleName.ADMIN))
    ) {
      await this.assertNotLastAdmin(id);
    }

    let roleId: string | undefined;
    if (dto.role) {
      const role = await this.prisma.role.findUniqueOrThrow({ where: { name: dto.role } });
      roleId = role.id;
    }
    if (dto.departmentId) {
      await this.assertDepartmentExists(dto.departmentId);
    }
    if (dto.managerId) {
      if (dto.managerId === id) {
        throw new BadRequestException("A user cannot be their own manager");
      }
      await this.assertUserExists(dto.managerId);
    }

    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 10) : undefined;

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        avatarUrl: dto.avatarUrl,
        isActive: dto.isActive,
        screenRecordingEnabled: dto.screenRecordingEnabled,
        canSignOut: dto.canSignOut,
        ...moduleAccess,
        roleId,
        passwordHash,
        githubUsername: dto.githubUsername,
        departmentId: dto.departmentId,
        managerId: dto.managerId,
        monthlyTarget: dto.monthlyTarget,
        shiftStart: dto.shiftStart,
        shiftEnd: dto.shiftEnd,
      },
      select: userSelect,
    });

    if (dto.password) {
      // Invalidate existing sessions so the newly set password is required immediately
      // Delete rather than mark revokedAt: refresh() keeps honouring revoked
      // tokens for a 24h rotation grace window, which would leave an old
      // session alive after an admin password reset.
      await this.prisma.refreshToken.deleteMany({ where: { userId: id } });
    }

    return updatedUser;
  }

  async updateTarget(id: string, monthlyTarget: number | null, user: RequestUser) {
    const targetUser = await this.findOne(id);

    const isDeptManager =
      user.role.name === RoleName.MANAGER &&
      !!user.department?.id &&
      targetUser.department?.id === user.department.id;
    const isAdmin = user.role.name === RoleName.ADMIN;

    if (!isAdmin && !isDeptManager) {
      throw new ForbiddenException("You do not have permission to update targets for this user");
    }

    return this.prisma.user.update({
      where: { id },
      data: { monthlyTarget },
      select: userSelect,
    });
  }

  async updateGithubUsername(id: string, githubUsername: string | null, user: RequestUser) {
    await this.findOne(id);

    const isAdmin = user.role.name === RoleName.ADMIN;
    const isSelf = user.id === id;
    if (!isAdmin && !isSelf) {
      throw new ForbiddenException("You can only link your own GitHub account");
    }

    if (githubUsername) {
      const existing = await this.prisma.user.findUnique({ where: { githubUsername } });
      if (existing && existing.id !== id) {
        throw new ConflictException("That GitHub username is already linked to another account");
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: { githubUsername },
      select: userSelect,
    });
  }

  // TODO: revisit -- no manager-chain cycle detection (A->B->C->A) yet, just the
  // direct self-manager check above. Disproportionate to this phase's scope.
  /**
   * Which modules a person gets. Only an Admin may choose them. With modulesCustomized true the picked
   * list is stored as given (unknown keys are rejected); with it false the list is cleared so the
   * role/department default applies. Returns {} when the request doesn't touch module access.
   */
  private resolveModuleAccess(
    dto: { modulesCustomized?: boolean; modules?: string[] },
    actor: RequestUser,
    current: { modulesCustomized: boolean },
  ): { modulesCustomized?: boolean; modules?: string[] } {
    if (dto.modulesCustomized === undefined && dto.modules === undefined) return {};
    if (actor.role.name !== RoleName.ADMIN) {
      throw new ForbiddenException("Only an admin can choose which modules someone can use");
    }
    const customized = dto.modulesCustomized ?? current.modulesCustomized;
    if (!customized) return { modulesCustomized: false, modules: [] };

    const { valid, invalid } = sanitizeModules(dto.modules ?? []);
    if (invalid.length > 0) {
      throw new BadRequestException(`Unknown module(s): ${invalid.join(", ")}`);
    }
    return { modulesCustomized: true, modules: valid };
  }

  private async assertDepartmentExists(departmentId: string) {
    const department = await this.prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) {
      throw new NotFoundException("Department not found");
    }
  }

  private async assertUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Manager not found");
    }
  }

  async deactivate(id: string, actor: RequestUser) {
    this.assertCanManageDirectory(actor);
    const target = await this.findOne(id);
    if (actor.role.name !== RoleName.ADMIN && target.role.name === RoleName.ADMIN) {
      throw new ForbiddenException("Only an admin can deactivate an admin account");
    }
    if (target.role.name === RoleName.ADMIN) {
      await this.assertNotLastAdmin(id);
    }
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: userSelect,
    });
  }

  /**
   * Permanently erases the account -- unlike deactivate(), this cannot be undone.
   * For HR: an employee who left and whose record you no longer want in the
   * directory at all, not someone you might reinstate (use Deactivate for that).
   *
   * Never silently destroys CRM data. The schema requires every "business
   * record" relation to User (deal owner, lead/task/project creator, job
   * postings, candidates, interviews, offers, clients, vendors, KB articles,
   * training videos, calls, and more) to point at a real person -- deleting a
   * user who still owns any of those is rejected by the database itself
   * (a foreign-key violation), not cascaded away. The counts below cover the
   * handful HR is most likely to hit day to day, for a clear, specific error;
   * anything else is still safely caught by the try/catch around the delete
   * itself, which turns an unanticipated one into the same kind of message
   * instead of a raw database error.
   *
   * What IS removed along with the account (by explicit, pre-existing schema
   * design -- see the Cascade relations in schema.prisma): their own login
   * history, refresh/reset tokens, screen recordings, activity pings, idle
   * events, notifications, chat read markers, AI assistant history, and
   * similar account-scoped data. That's judged personal to the account, not a
   * shared record someone else needs -- it goes with the account, same as it
   * always has for every relation already set to Cascade.
   */
  async permanentlyDelete(id: string, actor: RequestUser) {
    this.assertCanManageDirectory(actor);
    const target = await this.findOne(id);
    if (actor.role.name !== RoleName.ADMIN && target.role.name === RoleName.ADMIN) {
      throw new ForbiddenException("Only an admin can permanently delete an admin account");
    }
    if (target.role.name === RoleName.ADMIN) {
      await this.assertNotLastAdmin(id);
    }

    const [deals, leads, tasksCreated, projects] = await Promise.all([
      this.prisma.deal.count({ where: { ownerId: id } }),
      this.prisma.lead.count({ where: { createdById: id } }),
      this.prisma.task.count({ where: { creatorId: id } }),
      this.prisma.project.count({ where: { ownerId: id } }),
    ]);
    const blockers: string[] = [];
    if (deals > 0) blockers.push(`${deals} deal${deals === 1 ? "" : "s"}`);
    if (leads > 0) blockers.push(`${leads} lead${leads === 1 ? "" : "s"}`);
    if (tasksCreated > 0) blockers.push(`${tasksCreated} task${tasksCreated === 1 ? "" : "s"} they created`);
    if (projects > 0) blockers.push(`${projects} project${projects === 1 ? "" : "s"}`);
    if (blockers.length > 0) {
      throw new ConflictException(
        `${target.firstName} ${target.lastName} still owns ${blockers.join(", ")}. Reassign ${blockers.length === 1 ? "it" : "them"} to someone else first, then delete the account.`,
      );
    }

    try {
      await this.prisma.user.delete({ where: { id } });
    } catch (err) {
      // P2003: a foreign-key constraint still points at this user from some
      // other record type we didn't count above (job postings, candidates,
      // interviews, offers, clients, vendors, etc.) -- refuse cleanly rather
      // than let a raw database error through.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
        throw new ConflictException(
          `${target.firstName} ${target.lastName} still has other records linked to them elsewhere in the CRM (e.g. job postings, candidates, interviews, calls). Reassign or remove those first, then delete the account.`,
        );
      }
      throw err;
    }
    return { success: true };
  }

  // Deactivating/demoting the only remaining active admin would lock everyone
  // out of admin-only operations.
  private async assertNotLastAdmin(id: string) {
    const others = await this.prisma.user.count({
      where: { id: { not: id }, isActive: true, role: { name: RoleName.ADMIN } },
    });
    if (others === 0) {
      throw new BadRequestException("This is the last active admin; promote another admin first");
    }
  }

  private assertCanManageDirectory(actor: RequestUser) {
    if (!canManageDirectory(actor)) {
      throw new ForbiddenException("You do not have permission to manage the employee directory");
    }
  }

  private assertNotGrantingAdmin(actor: RequestUser, role: RoleName | undefined) {
    if (actor.role.name !== RoleName.ADMIN && role === RoleName.ADMIN) {
      throw new ForbiddenException("Only an admin can grant the Admin role");
    }
  }
}
