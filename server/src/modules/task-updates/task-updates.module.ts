import { Module } from "@nestjs/common";
import { TaskUpdatesController } from "./task-updates.controller";
import { TaskUpdatesService } from "./task-updates.service";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [NotificationsModule],
  controllers: [TaskUpdatesController],
  providers: [TaskUpdatesService],
  exports: [TaskUpdatesService],
})
export class TaskUpdatesModule {}
