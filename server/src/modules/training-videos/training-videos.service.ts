import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateTrainingVideoDto } from "./dto/create-training-video.dto";
import { UpdateTrainingVideoDto } from "./dto/update-training-video.dto";
import type { RequestUser } from "../../common/types/request-user.type";

// Who the "How to Use CRM" page is for: Admins and Managers of any department
// -- the tier that has to onboard their own team onto the CRM. Deliberately
// not department-scoped, unlike most reads here: the material is about the
// tool, so a Sales Manager and a Dev Head see the same library, including
// each other's posts.
//
// Posting a link uses this same rule, so any Manager can contribute
// walkthroughs for their own team, not just Admin.
function canManage(user: RequestUser): boolean {
  return user.role.name === RoleName.ADMIN || user.role.name === RoleName.MANAGER;
}

const videoSelect = {
  id: true,
  title: true,
  description: true,
  category: true,
  url: true,
  position: true,
  createdAt: true,
  updatedAt: true,
  uploader: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
} as const;

@Injectable()
export class TrainingVideosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTrainingVideoDto, user: RequestUser) {
    if (!canManage(user)) {
      throw new ForbiddenException("Only Admins and Managers can add training videos");
    }
    return this.prisma.trainingVideo.create({
      data: {
        title: dto.title,
        url: dto.url.trim(),
        description: dto.description?.trim() || null,
        category: dto.category?.trim() || null,
        position: dto.position ?? 0,
        uploaderId: user.id,
      },
      select: videoSelect,
    });
  }

  async findAll(_viewer: RequestUser) {
    return this.prisma.trainingVideo.findMany({
      // Nulls last so uncategorized videos ("General") sit below the named
      // sections rather than above them.
      orderBy: [
        { category: { sort: "asc", nulls: "last" } },
        { position: "asc" },
        { createdAt: "asc" },
      ],
      select: videoSelect,
    });
  }

  async update(id: string, dto: UpdateTrainingVideoDto, user: RequestUser) {
    await this.assertCanMutate(id, user);
    return this.prisma.trainingVideo.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.url !== undefined ? { url: dto.url.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.category !== undefined ? { category: dto.category?.trim() || null } : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
      },
      select: videoSelect,
    });
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    await this.assertCanMutate(id, user);
    await this.prisma.trainingVideo.delete({ where: { id } });
  }

  // Editing or deleting is narrower than posting: a Manager owns what they
  // added, and nothing else. Admin overrides everywhere, as everywhere else
  // in this codebase.
  private async assertCanMutate(id: string, user: RequestUser) {
    const video = await this.prisma.trainingVideo.findUnique({
      where: { id },
      select: { id: true, uploaderId: true },
    });
    if (!video) {
      throw new NotFoundException("Training video not found");
    }
    if (user.role.name === RoleName.ADMIN || video.uploaderId === user.id) {
      return video;
    }
    throw new ForbiddenException("You can only change training videos you added");
  }
}
