import { Module } from "@nestjs/common";
import { WorkSessionsController } from "./work-sessions.controller";
import { AttendanceSettingsController } from "./attendance-settings.controller";
import { NotificationsModule } from "../notifications/notifications.module";
import { WorkSessionsService } from "./work-sessions.service";
import { AttendanceCalendarService } from "./attendance-calendar.service";
import { AttendanceOversightService } from "./attendance-oversight.service";
import { AttendanceJobsService } from "./attendance-jobs.service";
import { AttendancePolicyService } from "./attendance-policy.service";
import { AttendanceReportService } from "./attendance-report.service";
import { ShiftTemplatesService } from "./shift-templates.service";

@Module({
  imports: [NotificationsModule],
  controllers: [WorkSessionsController, AttendanceSettingsController],
  providers: [
    WorkSessionsService,
    AttendancePolicyService,
    AttendanceCalendarService,
    AttendanceOversightService,
    AttendanceJobsService,
    AttendanceReportService,
    ShiftTemplatesService,
  ],
  exports: [WorkSessionsService, AttendanceCalendarService, AttendancePolicyService, AttendanceReportService],
})
export class WorkSessionsModule {}
