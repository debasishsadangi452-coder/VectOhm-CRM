import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { WorkSessionsService } from "./work-sessions.service";
import { AttendanceCalendarService } from "./attendance-calendar.service";
import { CorrectClockOutDto } from "./dto/correct-clock-out.dto";
import { CreateHolidayDto } from "./dto/create-holiday.dto";
import { AttendancePolicyService } from "./attendance-policy.service";
import { AttendanceReportService } from "./attendance-report.service";
import { ReviewReasonDto } from "./dto/review-reason.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { LateReasonDto } from "./dto/late-reason.dto";
import { ClockOutDto } from "./dto/clock-out.dto";
import { IdleEventDto } from "./dto/idle-event.dto";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("work-sessions")
export class WorkSessionsController {
  constructor(
    private readonly workSessionsService: WorkSessionsService,
    private readonly calendar: AttendanceCalendarService,
    private readonly policy: AttendancePolicyService,
    private readonly reports: AttendanceReportService,
  ) {}

  /** GET /work-sessions — own sessions (or all, for Admin/HR) */
  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query("userId") userId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    const range =
      (from && iso.test(from)) || (to && iso.test(to))
        ? {
            from: from && iso.test(from) ? from : undefined,
            to: to && iso.test(to) ? to : undefined,
          }
        : undefined;
    if (userId) {
      return this.workSessionsService.list(userId, user, range);
    }
    return this.workSessionsService.listAll(user, range);
  }

  /** GET /work-sessions/report — per-employee attendance numbers for a month / date range */
  @Get("report")
  report(
    @CurrentUser() user: RequestUser,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("userId") userId?: string,
    @Query("departmentId") departmentId?: string,
  ) {
    return this.reports.buildReport(user, { from, to, userId, departmentId });
  }

  /** GET /work-sessions/my-summary — the signed-in user's own month, streaks and recent days */
  @Get("my-summary")
  mySummary(@CurrentUser() user: RequestUser) {
    return this.reports.mySummary(user);
  }

  /** GET /work-sessions/live — who is working / on break / idle / not in, right now */
  @Get("live")
  live(@CurrentUser() user: RequestUser, @Query("departmentId") departmentId?: string) {
    return this.reports.getLiveBoard(user, { departmentId });
  }

  /** POST /work-sessions/:id/review — accept (excuse) or reject a late / early reason */
  @Post(":id/review")
  review(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: ReviewReasonDto) {
    return this.workSessionsService.reviewReason(user, id, dto);
  }

  /** GET /work-sessions/day-statuses — "Absent" / "On leave" days (no session) in a range */
  @Get("day-statuses")
  dayStatuses(
    @CurrentUser() user: RequestUser,
    @Query("userId") userId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.calendar.listDayStatuses(user, { userId, from, to });
  }

  /** GET /work-sessions/calendar — the weekly days off plus company holidays in a range (everyone can read) */
  @Get("calendar")
  async calendarInfo(@Query("from") from?: string, @Query("to") to?: string) {
    return {
      weeklyOffDays: (await this.policy.getGlobal()).weeklyOffDays,
      holidays: await this.calendar.listHolidays({ from, to }),
    };
  }

  /** GET /work-sessions/holidays — company holidays (everyone can read) */
  @Get("holidays")
  holidays(@Query("from") from?: string, @Query("to") to?: string) {
    return this.calendar.listHolidays({ from, to });
  }

  /** POST /work-sessions/holidays — Admin/HR add a holiday */
  @Post("holidays")
  createHoliday(@CurrentUser() user: RequestUser, @Body() dto: CreateHolidayDto) {
    return this.calendar.createHoliday(user, dto.date, dto.name);
  }

  /** DELETE /work-sessions/holidays/:id — Admin/HR remove a holiday */
  @Delete("holidays/:id")
  deleteHoliday(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.calendar.deleteHoliday(user, id);
  }

  /** GET /work-sessions/pending-correction — an auto-closed session the user must still correct, or null */
  @Get("pending-correction")
  pendingCorrection(@CurrentUser() user: RequestUser) {
    return this.workSessionsService.getPendingCorrection(user.id);
  }

  /** POST /work-sessions/:id/correct-clock-out — say when you really finished */
  @Post(":id/correct-clock-out")
  correctClockOut(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: CorrectClockOutDto,
  ) {
    return this.workSessionsService.submitCorrection(user, id, dto);
  }

  /** GET /work-sessions/active — returns the user's open session or null */
  @Get("active")
  getActive(@CurrentUser() user: RequestUser) {
    return this.workSessionsService.getActive(user.id);
  }

  /** POST /work-sessions/clock-in — start a new session */
  @Post("clock-in")
  clockIn(@CurrentUser() user: RequestUser) {
    return this.workSessionsService.clockIn(user);
  }

  /** POST /work-sessions/idle-events — reason for an idle stretch past the idle-prompt setting */
  @Post("idle-events")
  submitIdleReason(@CurrentUser() user: RequestUser, @Body() dto: IdleEventDto) {
    return this.workSessionsService.submitIdleReason(user, dto);
  }

  /** POST /work-sessions/:id/late-reason — why the user clocked in late */
  @Post(":id/late-reason")
  submitLateReason(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: LateReasonDto,
  ) {
    return this.workSessionsService.submitLateReason(user, id, dto.reason);
  }

  /** POST /work-sessions/clock-out — end the active session */
  @Post("clock-out")
  clockOut(@CurrentUser() user: RequestUser, @Body() dto: ClockOutDto) {
    return this.workSessionsService.clockOut(user, dto?.reason);
  }

  /** POST /work-sessions/break/start — start a 1-hour break */
  @Post("break/start")
  startBreak(@CurrentUser() user: RequestUser) {
    return this.workSessionsService.startBreak(user);
  }

  /** POST /work-sessions/break/end — end current break and begin 5-hour cooldown */
  @Post("break/end")
  endBreak(@CurrentUser() user: RequestUser) {
    return this.workSessionsService.endBreak(user);
  }
}
