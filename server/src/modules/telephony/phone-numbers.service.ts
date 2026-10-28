import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreatePhoneNumberDto } from "./dto/create-phone-number.dto";
import { UpdatePhoneNumberDto } from "./dto/update-phone-number.dto";
import { canUseSalesOutreach } from "../../common/utils/sales-access";
import type { RequestUser } from "../../common/types/request-user.type";

// Registered here by an Admin after the number is actually purchased/
// configured in the JustCall dashboard (see the plan's §24) -- this table is
// just the CRM's picture of which numbers exist and who they're for, not the
// source of truth for the number itself.
@Injectable()
export class PhoneNumbersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(user: RequestUser) {
    if (!canUseSalesOutreach(user)) {
      throw new ForbiddenException("Calling is only available to the Sales department");
    }
    return this.prisma.phoneNumber.findMany({ orderBy: { createdAt: "asc" } });
  }

  async create(dto: CreatePhoneNumberDto) {
    return this.prisma.phoneNumber.create({
      data: {
        providerId: dto.providerId,
        e164: dto.e164,
        country: dto.country.toUpperCase(),
        label: dto.label,
        departmentId: dto.departmentId,
        smsCapable: dto.smsCapable ?? true,
      },
    });
  }

  async update(id: string, dto: UpdatePhoneNumberDto) {
    await this.getOne(id);
    return this.prisma.phoneNumber.update({
      where: { id },
      data: { label: dto.label, departmentId: dto.departmentId, active: dto.active },
    });
  }

  async remove(id: string): Promise<void> {
    await this.getOne(id);
    await this.prisma.phoneNumber.delete({ where: { id } });
  }

  private async getOne(id: string) {
    const number = await this.prisma.phoneNumber.findUnique({ where: { id } });
    if (!number) {
      throw new NotFoundException("Phone number not found");
    }
    return number;
  }
}
