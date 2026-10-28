import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { CompaniesService } from "./companies.service";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { UpdateCompanyDto } from "./dto/update-company.dto";

// No @Roles() anywhere in this controller -- Companies are shared reference
// data with no natural owner; open to any authenticated user (reads AND
import { Department } from "../../common/decorators/department.decorator";

@Department("Sales")
@Controller("companies")
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  findAll() {
    return this.companiesService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.companiesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.companiesService.remove(id);
  }
}
