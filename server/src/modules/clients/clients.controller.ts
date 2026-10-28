import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ClientsService } from "./clients.service";
import { CreateClientDto } from "./dto/create-client.dto";
import { UpdateClientDto } from "./dto/update-client.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Department } from "../../common/decorators/department.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Department("Recruitment")
@Controller("clients")
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  findAll() {
    return this.clientsService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.clientsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateClientDto, @CurrentUser() user: RequestUser) {
    return this.clientsService.create(dto, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateClientDto, @CurrentUser() user: RequestUser) {
    return this.clientsService.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.clientsService.remove(id, user);
  }
}
