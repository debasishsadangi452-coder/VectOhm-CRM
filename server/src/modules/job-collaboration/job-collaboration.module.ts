import { Module } from "@nestjs/common";
import { JobCollaborationController } from "./job-collaboration.controller";
import { JobCollaborationService } from "./job-collaboration.service";

@Module({
  controllers: [JobCollaborationController],
  providers: [JobCollaborationService],
})
export class JobCollaborationModule {}
