import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from "@nestjs/common";
import { ReleasesService } from "./releases.service";
import { CreateReleaseDto } from "./dto/create-release.dto";
import { UpdateReleaseDto } from "./dto/update-release.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("releases")
export class ReleasesController {
  constructor(private readonly releasesService: ReleasesService) {}

  @Post()
  create(@Body() dto: CreateReleaseDto, @CurrentUser() user: RequestUser) {
    return this.releasesService.create(dto, user);
  }

  @Get()
  findAll(@Query("departmentId") departmentId: string | undefined, @CurrentUser() user: RequestUser) {
    return this.releasesService.findAll(departmentId, user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.releasesService.findOne(id, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateReleaseDto, @CurrentUser() user: RequestUser) {
    return this.releasesService.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.releasesService.remove(id, user);
  }
}
