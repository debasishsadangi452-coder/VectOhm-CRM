import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateVendorDto } from "./dto/create-vendor.dto";
import { UpdateVendorDto } from "./dto/update-vendor.dto";
import type { RequestUser } from "../../common/types/request-user.type";

const vendorInclude = {
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  modifiedBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

@Injectable()
export class VendorsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.vendor.findMany({
      include: vendorInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id }, include: vendorInclude });
    if (!vendor) {
      throw new NotFoundException("Vendor not found");
    }
    return vendor;
  }

  create(dto: CreateVendorDto, creator: RequestUser) {
    return this.prisma.vendor.create({
      data: {
        name: dto.name,
        website: dto.website,
        contactNumber: dto.contactNumber,
        state: dto.state,
        country: dto.country,
        ownership: dto.ownership,
        businessUnit: dto.businessUnit,
        contactPerson: dto.contactPerson,
        email: dto.email,
        category: dto.category,
        createdById: creator.id,
      },
      include: vendorInclude,
    });
  }

  async update(id: string, dto: UpdateVendorDto, user: RequestUser) {
    const vendor = await this.getOwned(id);
    this.assertCanMutate(vendor, user);

    return this.prisma.vendor.update({
      where: { id },
      data: {
        name: dto.name,
        website: dto.website,
        contactNumber: dto.contactNumber,
        state: dto.state,
        country: dto.country,
        ownership: dto.ownership,
        businessUnit: dto.businessUnit,
        contactPerson: dto.contactPerson,
        email: dto.email,
        category: dto.category,
        modifiedById: user.id,
      },
      include: vendorInclude,
    });
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const vendor = await this.getOwned(id);
    this.assertCanMutate(vendor, user);
    await this.prisma.vendor.delete({ where: { id } });
  }

  private async getOwned(id: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id } });
    if (!vendor) {
      throw new NotFoundException("Vendor not found");
    }
    return vendor;
  }

  private assertCanMutate(vendor: { createdById: string }, user: RequestUser) {
    if (user.role.name === RoleName.ADMIN) return;
    if (vendor.createdById !== user.id) {
      throw new ForbiddenException("You do not have permission to modify this vendor");
    }
  }
}
