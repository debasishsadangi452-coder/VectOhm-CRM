import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { CompanyGrowthSignalStatus } from "@prisma/client";
import { CompanyGrowthService } from "./company-growth.service";
import { AcceptGrowthSignalDto } from "./dto/accept-growth-signal.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("company-growth-signals")
export class CompanyGrowthController {
  constructor(private readonly service: CompanyGrowthService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query("status") status?: CompanyGrowthSignalStatus,
    @Query("companyId") companyId?: string,
  ) {
    return this.service.list(user, { status, companyId });
  }

  // Every article NewsAPI has returned, whether or not it became a signal --
  // lets a Sales user confirm the news half of the pipeline is actually
  // fetching data, independent of Claude classification.
  @Get("news-log")
  newsLog(@CurrentUser() user: RequestUser, @Query("companyId") companyId?: string) {
    return this.service.listNewsLog(user, { companyId });
  }

  // Manual trigger -- doesn't wait for the 6am cron.
  @Post("scan-news")
  scanNewsNow(@CurrentUser() user: RequestUser) {
    return this.service.runNewsScanNow(user);
  }

  // Manual trigger for the Apollo-native scan (active hiring / headcount
  // growth) -- doesn't wait for the 7am cron.
  @Post("scan-apollo")
  scanApolloNow(@CurrentUser() user: RequestUser) {
    return this.service.runApolloScanNow(user);
  }

  // Explicit human accept -- this is the only path in the app that turns a
  // growth signal into an actual outreach email (via SequencesService).
  @Post(":id/accept")
  accept(@Param("id") id: string, @Body() dto: AcceptGrowthSignalDto, @CurrentUser() user: RequestUser) {
    return this.service.accept(id, dto.sequenceId, user);
  }

  @Post(":id/dismiss")
  dismiss(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.dismiss(id, user);
  }
}
