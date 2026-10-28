import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { DepartmentsService } from "./departments.service";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";
import { UpdateDepartmentSettingsDto } from "./dto/update-department-settings.dto";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("departments")
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  // Open to any authenticated user -- other modules (CRM, Recruitment, etc.) will
  // need department pickers later.
  @Get()
  findAll() {
    return this.departmentsService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.departmentsService.findOne(id);
  }

  // Admin OR HR (see canManageDirectory) -- enforced in the service.
  @Post()
  create(@Body() dto: CreateDepartmentDto, @CurrentUser() actor: RequestUser) {
    return this.departmentsService.create(dto, actor);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateDepartmentDto, @CurrentUser() actor: RequestUser) {
    return this.departmentsService.update(id, dto, actor);
  }

  @Patch(":id/settings")
  updateSettings(
    @Param("id") id: string,
    @Body() dto: UpdateDepartmentSettingsDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.departmentsService.updateSettings(id, dto, user);
  }

  @Roles(RoleName.ADMIN)
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.departmentsService.remove(id);
  }
}
