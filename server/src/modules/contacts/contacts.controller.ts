import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ContactsService } from "./contacts.service";
import { CreateContactDto } from "./dto/create-contact.dto";
import { UpdateContactDto } from "./dto/update-contact.dto";
import { ImportContactsDto } from "./dto/import-contacts.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Department } from "../../common/decorators/department.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Department("Sales", "Recruitment")
@Controller("contacts")
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  // Must come before ":id" -- otherwise "import" would be parsed as an id.
  @Post("import")
  importBatch(@Body() dto: ImportContactsDto, @CurrentUser() user: RequestUser) {
    return this.contactsService.importBatch(dto, user);
  }

  @Get("import/batches")
  listImportBatches() {
    return this.contactsService.listImportBatches();
  }

  @Get()
  findAll(@Query("companyId") companyId?: string) {
    return this.contactsService.findAll({ companyId });
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.contactsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateContactDto) {
    return this.contactsService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateContactDto) {
    return this.contactsService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.contactsService.remove(id);
  }
}
