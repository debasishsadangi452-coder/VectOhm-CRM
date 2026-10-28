import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { EmailTemplatesService } from "./email-templates.service";
import { CreateEmailTemplateDto } from "./dto/create-email-template.dto";
import { UpdateEmailTemplateDto } from "./dto/update-email-template.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("email-templates")
export class EmailTemplatesController {
  constructor(private readonly emailTemplatesService: EmailTemplatesService) {}

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.emailTemplatesService.findAll(user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.emailTemplatesService.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateEmailTemplateDto, @CurrentUser() user: RequestUser) {
    return this.emailTemplatesService.create(dto, user);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateEmailTemplateDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.emailTemplatesService.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.emailTemplatesService.remove(id, user);
  }
}
