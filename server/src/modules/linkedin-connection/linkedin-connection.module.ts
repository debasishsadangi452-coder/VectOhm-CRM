import { Module } from "@nestjs/common";
import { LinkedInConnectionController } from "./linkedin-connection.controller";
import { LinkedInConnectionService } from "./linkedin-connection.service";
import { UnipileService } from "./unipile.service";
import { PrismaService } from "../../prisma/prisma.service";

@Module({
  controllers: [LinkedInConnectionController],
  providers: [LinkedInConnectionService, UnipileService, PrismaService],
  exports: [LinkedInConnectionService, UnipileService],
})
export class LinkedInConnectionModule {}
