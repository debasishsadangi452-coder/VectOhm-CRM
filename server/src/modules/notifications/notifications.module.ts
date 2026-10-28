import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { NotificationsGateway } from "./notifications.gateway";

@Module({
  // Same JwtModule.register({}) shape as AuthModule -- no default options,
  // the secret is passed explicitly per-call (see NotificationsGateway,
  // AuthService) rather than configured module-wide.
  imports: [JwtModule.register({})],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway],
  // Export so other modules (LeaveRequests, Tasks, Engagement) can inject
  // NotificationsService/NotificationsGateway
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
