import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateEboardingDto, EboardingChecklistItemDto } from "./dto/create-eboarding.dto";
import { UpdateEboardingDto } from "./dto/update-eboarding.dto";
import { UpdateEboardingStatusDto } from "./dto/update-eboarding-status.dto";
import type { RequestUser } from "../../common/types/request-user.type";

const eboardingInclude = {
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

// Strips class-transformer instance-ness down to plain objects so Prisma's
// Json column gets ordinary serializable data.
function toChecklistJson(items: EboardingChecklistItemDto[] | undefined) {
  if (!items) return undefined;
  return items.map((item) => ({ id: item.id, name: item.name, completed: item.completed }));
}

@Injectable()
export class EboardingService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.eboarding.findMany({
      include: eboardingInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.eboarding.findUnique({ where: { id }, include: eboardingInclude });
    if (!item) {
      throw new NotFoundException("Eboarding record not found");
    }
    return item;
  }

  create(dto: CreateEboardingDto, creator: RequestUser) {
    return this.prisma.eboarding.create({
      data: {
        name: dto.name,
        middleName: dto.middleName,
        lastName: dto.lastName,
        email: dto.email,
        alternateEmail: dto.alternateEmail,
        phone: dto.phone,
        gender: dto.gender,
        jobTitle: dto.jobTitle,
        country: dto.country,
        state: dto.state,
        city: dto.city,
        zipCode: dto.zipCode,
        streetAddress: dto.streetAddress,
        employmentType: dto.employmentType,
        onboardingCode: dto.onboardingCode,
        taxTerms: dto.taxTerms,
        vendorName: dto.vendorName,
        vendorEmail: dto.vendorEmail,
        atsBu: dto.atsBu,
        client: dto.client,
        startDate: dto.startDate,
        endDate: dto.endDate,
        joiningDate: dto.joiningDate,
        billRate: dto.billRate,
        payRate: dto.payRate,
        placementType: dto.placementType,
        comments: dto.comments,
        status: dto.status,
        checklist: toChecklistJson(dto.checklist),
        initiatedOn: dto.initiatedOn ?? new Date().toISOString().split("T")[0],
        createdById: creator.id,
      },
      include: eboardingInclude,
    });
  }

  async update(id: string, dto: UpdateEboardingDto, user: RequestUser) {
    const item = await this.getOwned(id);
    this.assertCanMutate(item, user);

    return this.prisma.eboarding.update({
      where: { id },
      data: {
        name: dto.name,
        middleName: dto.middleName,
        lastName: dto.lastName,
        email: dto.email,
        alternateEmail: dto.alternateEmail,
        phone: dto.phone,
        gender: dto.gender,
        jobTitle: dto.jobTitle,
        country: dto.country,
        state: dto.state,
        city: dto.city,
        zipCode: dto.zipCode,
        streetAddress: dto.streetAddress,
        employmentType: dto.employmentType,
        onboardingCode: dto.onboardingCode,
        taxTerms: dto.taxTerms,
        vendorName: dto.vendorName,
        vendorEmail: dto.vendorEmail,
        atsBu: dto.atsBu,
        client: dto.client,
        startDate: dto.startDate,
        endDate: dto.endDate,
        joiningDate: dto.joiningDate,
        billRate: dto.billRate,
        payRate: dto.payRate,
        placementType: dto.placementType,
        comments: dto.comments,
        status: dto.status,
        checklist: toChecklistJson(dto.checklist),
      },
      include: eboardingInclude,
    });
  }

  async updateStatus(id: string, dto: UpdateEboardingStatusDto, user: RequestUser) {
    const item = await this.getOwned(id);
    this.assertCanMutate(item, user);

    return this.prisma.eboarding.update({
      where: { id },
      data: { status: dto.status },
      include: eboardingInclude,
    });
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const item = await this.getOwned(id);
    this.assertCanMutate(item, user);
    await this.prisma.eboarding.delete({ where: { id } });
  }

  private async getOwned(id: string) {
    const item = await this.prisma.eboarding.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException("Eboarding record not found");
    }
    return item;
  }

  private assertCanMutate(item: { createdById: string }, user: RequestUser) {
    if (user.role.name === RoleName.ADMIN) return;
    if (item.createdById !== user.id) {
      throw new ForbiddenException("You do not have permission to modify this eboarding record");
    }
  }
}
