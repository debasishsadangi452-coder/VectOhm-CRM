import { Module } from "@nestjs/common";
import { SeoKpiGoalsService } from "./seo-kpi-goals.service";
import { SeoKpiGoalsController } from "./seo-kpi-goals.controller";

@Module({
  controllers: [SeoKpiGoalsController],
  providers: [SeoKpiGoalsService],
})
export class SeoKpiGoalsModule {}
