import { Module } from "@nestjs/common";
import { ActivitiesController } from "./activities.controller";
import { ActivitiesService } from "./activities.service";
import { EngagementModule } from "../engagement/engagement.module";

@Module({
  imports: [EngagementModule],
  controllers: [ActivitiesController],
  providers: [ActivitiesService],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
