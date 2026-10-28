import { Module } from "@nestjs/common";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";
import { TaskCommunicationService } from "./task-communication.service";
import { TaskDeadlineService } from "./task-deadline.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { EngagementModule } from "../engagement/engagement.module";
import { ChatModule } from "../chat/chat.module";

@Module({
  imports: [NotificationsModule, EngagementModule, ChatModule],
  controllers: [TasksController],
  providers: [TasksService, TaskCommunicationService, TaskDeadlineService],
  exports: [TasksService, TaskCommunicationService, TaskDeadlineService],
})
export class TasksModule {}
