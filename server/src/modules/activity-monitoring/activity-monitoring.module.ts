import { Module } from "@nestjs/common";
import { ActivityMonitoringController } from "./activity-monitoring.controller";
import { ActivityMonitoringService } from "./activity-monitoring.service";
import { WorkSessionsModule } from "../work-sessions/work-sessions.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [WorkSessionsModule, NotificationsModule],
  controllers: [ActivityMonitoringController],
  providers: [ActivityMonitoringService],
})
export class ActivityMonitoringModule {}
