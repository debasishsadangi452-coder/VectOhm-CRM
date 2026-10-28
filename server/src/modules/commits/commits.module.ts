import { Module } from "@nestjs/common";
import { CommitsService } from "./commits.service";
import { CommitsController } from "./commits.controller";
import { PrismaModule } from "../../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [CommitsController],
  providers: [CommitsService],
  exports: [CommitsService],
})
export class CommitsModule {}
