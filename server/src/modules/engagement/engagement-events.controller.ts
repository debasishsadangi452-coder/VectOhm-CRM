import { Controller, Get, Param, Query } from "@nestjs/common";
import { EngagementEventsService } from "./engagement-events.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("engagement")
export class EngagementEventsController {
  constructor(private readonly engagementEvents: EngagementEventsService) {}

  @Get("metrics")
  getMetrics(@CurrentUser() user: RequestUser) {
    return this.engagementEvents.getMetrics(user);
  }

  @Get("campaign-metrics/:id")
  getCampaignMetrics(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.engagementEvents.getCampaignMetrics(id, user);
  }

  @Get("sequence-metrics/:id")
  getSequenceMetrics(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.engagementEvents.getSequenceMetrics(id, user);
  }

  @Get("events")
  findAll(
    @CurrentUser() user: RequestUser,
    @Query("contactId") contactId?: string,
    @Query("dealId") dealId?: string,
    @Query("campaignId") campaignId?: string,
    @Query("sequenceId") sequenceId?: string,
    @Query("recipientId") recipientId?: string,
    @Query("take") take?: string,
  ) {
    return this.engagementEvents.findAll(
      {
        contactId,
        dealId,
        campaignId,
        sequenceId,
        recipientId,
        take: take ? Number(take) : undefined,
      },
      user,
    );
  }
}
