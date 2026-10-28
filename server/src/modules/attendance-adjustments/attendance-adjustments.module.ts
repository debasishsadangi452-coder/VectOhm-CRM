import { Module } from "@nestjs/common";
import { AttendanceAdjustmentsController } from "./attendance-adjustments.controller";
import { AttendanceAdjustmentsService } from "./attendance-adjustments.service";

@Module({
  controllers: [AttendanceAdjustmentsController],
  providers: [AttendanceAdjustmentsService],
})
export class AttendanceAdjustmentsModule {}
