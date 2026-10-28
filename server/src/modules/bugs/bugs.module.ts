import { Module } from "@nestjs/common";
import { BugsController } from "./bugs.controller";
import { BugsService } from "./bugs.service";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [NotificationsModule],
  controllers: [BugsController],
  providers: [BugsService],
  exports: [BugsService],
})
export class BugsModule {}
