import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { CandidateStage } from "@prisma/client";
import { RecruitmentAnalyticsService } from "./recruitment-analytics.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Department } from "../../common/decorators/department.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Department("Recruitment")
@Controller("recruitment-analytics")
export class RecruitmentAnalyticsController {
  constructor(private readonly recruitmentAnalyticsService: RecruitmentAnalyticsService) {}

  @Get("summary")
  getSummary(@CurrentUser() user: RequestUser) {
    return this.recruitmentAnalyticsService.getSummary(user);
  }

  @Get("ros-health")
  getRosHealth(@CurrentUser() user: RequestUser) {
    return this.recruitmentAnalyticsService.getRosHealth(user);
  }

  @Get("rediscovery")
  getRediscovery(@Query("jobPostingId") jobPostingId?: string) {
    return this.recruitmentAnalyticsService.getRediscovery(jobPostingId);
  }

  @Post("rediscovery/reactivate")
  reactivateCandidate(
    @Body() body: { candidateId: string; jobPostingId: string },
    @CurrentUser() user: RequestUser,
  ) {
    return this.recruitmentAnalyticsService.reactivateCandidate(body.candidateId, body.jobPostingId, user);
  }

  @Get("action-queue")
  getActionQueue(@CurrentUser() user: RequestUser) {
    return this.recruitmentAnalyticsService.getActionQueue(user);
  }

  @Get("sla-priority-queue")
  getSLAPriorityQueue(@CurrentUser() user: RequestUser) {
    return this.recruitmentAnalyticsService.getSLAPriorityQueue(user);
  }

  @Post("sla-action/nudge")
  triggerSlaNudge(@Body() body: { candidateId: string; message?: string }) {
    return this.recruitmentAnalyticsService.triggerSlaNudge(body.candidateId, body.message);
  }

  @Post("sla-action/remind-interviewer")
  triggerInterviewerReminder(@Body() body: { interviewId: string }) {
    return this.recruitmentAnalyticsService.triggerInterviewerReminder(body.interviewId);
  }

  @Post("sla-action/advance-stage")
  advanceSlaStage(
    @Body() body: { candidateId: string; nextStage: CandidateStage },
    @CurrentUser() user: RequestUser,
  ) {
    return this.recruitmentAnalyticsService.advanceSlaStage(body.candidateId, body.nextStage, user);
  }

  @Get("team-performance")
  getTeamPerformance(
    @CurrentUser() user: RequestUser,
    @Query("range") range?: string,
  ) {
    return this.recruitmentAnalyticsService.getTeamPerformance(user, range);
  }

  @Get("talent-pools")
  getTalentPools() {
    return this.recruitmentAnalyticsService.getTalentPools();
  }

  @Get("candidate-risk/:id")
  getCandidateRiskProfile(@Param("id") id: string) {
    return this.recruitmentAnalyticsService.getCandidateRiskProfile(id);
  }
}
