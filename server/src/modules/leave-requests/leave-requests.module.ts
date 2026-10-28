import { Module } from "@nestjs/common";
import { LeaveRequestsController } from "./leave-requests.controller";
import { LeaveRequestsService } from "./leave-requests.service";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [NotificationsModule],
  controllers: [LeaveRequestsController],
  providers: [LeaveRequestsService],
  exports: [LeaveRequestsService],
})
export class LeaveRequestsModule {}

