import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { UpdateCompanyDto } from "./dto/update-company.dto";

const companyInclude = {
  _count: { select: { contacts: true, deals: true } },
} as const;

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.company.findMany({ include: companyInclude, orderBy: { name: "asc" } });
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        ...companyInclude,
        contacts: { select: { id: true, firstName: true, lastName: true, email: true } },
        deals: { select: { id: true, title: true, stage: true, value: true } },
      },
    });
    if (!company) {
      throw new NotFoundException("Company not found");
    }
    return company;
  }

  async create(dto: CreateCompanyDto) {
    const existing = await this.prisma.company.findUnique({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException("Company name already in use");
    }

    return this.prisma.company.create({
      data: { name: dto.name, domain: dto.domain, industry: dto.industry, notes: dto.notes },
      include: companyInclude,
    });
  }

  async update(id: string, dto: UpdateCompanyDto) {
    await this.getOwned(id);

    if (dto.name) {
      const existing = await this.prisma.company.findUnique({ where: { name: dto.name } });
      if (existing && existing.id !== id) {
        throw new ConflictException("Company name already in use");
      }
    }

    return this.prisma.company.update({
      where: { id },
      data: { name: dto.name, domain: dto.domain, industry: dto.industry, notes: dto.notes },
      include: companyInclude,
    });
  }

  // No ownership check -- Companies are shared reference data, open to any
  // authenticated user (see phase-3 plan's RBAC section).
  async remove(id: string) {
    await this.getOwned(id);
    await this.prisma.company.delete({ where: { id } });
  }

  private async getOwned(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundException("Company not found");
    }
    return company;
  }
}
