import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { UpdateAppSettingsDto } from "./dto/update-app-settings.dto";

const SETTINGS_ID = "app-settings";

@Injectable()
export class AppSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const settings = await this.prisma.appSettings.findUnique({ where: { id: SETTINGS_ID } });
    return { heroTagline: settings?.heroTagline ?? null };
  }

  async update(dto: UpdateAppSettingsDto) {
    const settings = await this.prisma.appSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, heroTagline: dto.heroTagline },
      update: { heroTagline: dto.heroTagline },
    });
    return { heroTagline: settings.heroTagline };
  }
}
