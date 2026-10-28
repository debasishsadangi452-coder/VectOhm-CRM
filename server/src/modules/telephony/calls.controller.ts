import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CallStatus } from "@prisma/client";
import { CallsService } from "./calls.service";
import { CreateCallDto } from "./dto/create-call.dto";
import { UpdateCallDispositionDto } from "./dto/update-call-disposition.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Department } from "../../common/decorators/department.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Department("Sales")
@Controller("telephony/calls")
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @Get()
  findAll(
    @CurrentUser() user: RequestUser,
    @Query("contactId") contactId?: string,
    @Query("dealId") dealId?: string,
    @Query("agentId") agentId?: string,
    @Query("status") status?: CallStatus,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.callsService.findAll({ contactId, dealId, agentId, status, from, to }, user);
  }

  // Must come before ":id" -- otherwise "lookup"/"analytics" would be parsed
  // as an id, same convention as ContactsController's "import" route.
  @Get("lookup")
  lookupByPhone(@Query("number") number: string, @CurrentUser() user: RequestUser) {
    return this.callsService.lookupByPhone(number, user);
  }

  @Get("analytics")
  analytics(
    @CurrentUser() user: RequestUser,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.callsService.analytics({ from, to }, user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.callsService.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateCallDto, @CurrentUser() user: RequestUser) {
    return this.callsService.create(dto, user);
  }

  @Patch(":id/link-provider-id")
  linkProviderCallId(
    @Param("id") id: string,
    @Body("providerCallId") providerCallId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.callsService.linkProviderCallId(id, providerCallId, user);
  }

  @Patch(":id/disposition")
  updateDisposition(
    @Param("id") id: string,
    @Body() dto: UpdateCallDispositionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.callsService.updateDisposition(id, dto, user);
  }
}
