import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CallCampaignsService } from "./call-campaigns.service";
import { CreateCallCampaignDto } from "./dto/create-call-campaign.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Department } from "../../common/decorators/department.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Department("Sales")
@Controller("telephony/campaigns")
export class CallCampaignsController {
  constructor(private readonly campaignsService: CallCampaignsService) {}

  // Must come before ":id" -- otherwise "my-queue" would be parsed as an id.
  @Get("my-queue")
  myQueue(@CurrentUser() user: RequestUser) {
    return this.campaignsService.myQueue(user);
  }

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.campaignsService.findAll(user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.campaignsService.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateCallCampaignDto, @CurrentUser() user: RequestUser) {
    return this.campaignsService.create(dto, user);
  }

  @Post(":id/claim-next")
  claimNext(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.campaignsService.claimNext(id, user);
  }
}
