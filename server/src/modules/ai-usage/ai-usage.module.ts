import { Module } from "@nestjs/common";
import { AiUsageController } from "./ai-usage.controller";
import { AiUsageService } from "./ai-usage.service";
import { PrismaModule } from "../../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [AiUsageController],
  providers: [AiUsageService],
  exports: [AiUsageService],
})
export class AiUsageModule {}
