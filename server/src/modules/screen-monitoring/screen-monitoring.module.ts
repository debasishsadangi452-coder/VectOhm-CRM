import { Module } from "@nestjs/common";
import { ScreenMonitoringController } from "./screen-monitoring.controller";
import { ScreenMonitoringService } from "./screen-monitoring.service";
import { ScreenshotStorageService } from "./screenshot-storage.service";
import { WorkSessionsModule } from "../work-sessions/work-sessions.module";

@Module({
  imports: [WorkSessionsModule],
  controllers: [ScreenMonitoringController],
  providers: [ScreenMonitoringService, ScreenshotStorageService],
})
export class ScreenMonitoringModule {}
