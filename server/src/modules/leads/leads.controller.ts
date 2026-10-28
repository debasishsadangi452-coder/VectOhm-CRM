import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { LeadsService } from "./leads.service";
import { CreateLeadDto } from "./dto/create-lead.dto";
import { UpdateLeadDto } from "./dto/update-lead.dto";
import { InboundLeadDto } from "./dto/inbound-lead.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Department } from "../../common/decorators/department.decorator";
import { Public } from "../../common/decorators/public.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Department("Recruitment")
@Controller("leads")
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Public()
  @Post("inbound")
  createInbound(@Body() dto: InboundLeadDto) {
    return this.leadsService.createInboundLead(dto);
  }

  @Get()
  findAll() {
    return this.leadsService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.leadsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateLeadDto, @CurrentUser() user: RequestUser) {
    return this.leadsService.create(dto, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateLeadDto, @CurrentUser() user: RequestUser) {
    return this.leadsService.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.leadsService.remove(id, user);
  }
}
