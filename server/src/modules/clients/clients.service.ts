import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateClientDto } from "./dto/create-client.dto";
import { UpdateClientDto } from "./dto/update-client.dto";
import type { RequestUser } from "../../common/types/request-user.type";

const clientInclude = {
  primaryOwner: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.client.findMany({
      include: clientInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({ where: { id }, include: clientInclude });
    if (!client) {
      throw new NotFoundException("Client not found");
    }
    return client;
  }

  create(dto: CreateClientDto, creator: RequestUser) {
    return this.prisma.client.create({
      data: {
        name: dto.name,
        contactNumber: dto.contactNumber,
        website: dto.website,
        industry: dto.industry,
        status: dto.status,
        category: dto.category,
        businessUnit: dto.businessUnit,
        displayOnJob: dto.displayOnJob,
        primaryOwnerId: dto.primaryOwnerId,
        createdById: creator.id,
      },
      include: clientInclude,
    });
  }

  async update(id: string, dto: UpdateClientDto, user: RequestUser) {
    const client = await this.getOwned(id);
    this.assertCanMutate(client, user);

    return this.prisma.client.update({
      where: { id },
      data: {
        name: dto.name,
        contactNumber: dto.contactNumber,
        website: dto.website,
        industry: dto.industry,
        status: dto.status,
        category: dto.category,
        businessUnit: dto.businessUnit,
        displayOnJob: dto.displayOnJob,
        primaryOwnerId: dto.primaryOwnerId,
      },
      include: clientInclude,
    });
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const client = await this.getOwned(id);
    this.assertCanMutate(client, user);
    await this.prisma.client.delete({ where: { id } });
  }

  private async getOwned(id: string) {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) {
      throw new NotFoundException("Client not found");
    }
    return client;
  }

  // Reference data, not department-scoped by row -- @Department("Recruitment")
  // on the controller already gates read/create to that department; mutation
  // is further limited to ADMIN or whoever created the row.
  private assertCanMutate(client: { createdById: string }, user: RequestUser) {
    if (user.role.name === RoleName.ADMIN) return;
    if (client.createdById !== user.id) {
      throw new ForbiddenException("You do not have permission to modify this client");
    }
  }
}
