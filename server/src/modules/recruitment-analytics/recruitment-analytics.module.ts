import { Module } from "@nestjs/common";
import { RecruitmentAnalyticsController } from "./recruitment-analytics.controller";
import { RecruitmentAnalyticsService } from "./recruitment-analytics.service";

@Module({
  controllers: [RecruitmentAnalyticsController],
  providers: [RecruitmentAnalyticsService],
})
export class RecruitmentAnalyticsModule {}
