import { Module } from "@nestjs/common";
import { EngagementEventsController } from "./engagement-events.controller";
import { EngagementEventsService } from "./engagement-events.service";
import { EngagementScoreService } from "./engagement-score.service";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [NotificationsModule],
  controllers: [EngagementEventsController],
  providers: [EngagementEventsService, EngagementScoreService],
  exports: [EngagementEventsService, EngagementScoreService],
})
export class EngagementModule {}
