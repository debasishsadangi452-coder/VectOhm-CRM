import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { CommitsService } from "./commits.service";
import { CreateCommitDto } from "./dto/create-commit.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("commits")
export class CommitsController {
  constructor(private readonly commitsService: CommitsService) {}

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.commitsService.findAll(user);
  }

  @Post()
  create(@Body() dto: CreateCommitDto, @CurrentUser() user: RequestUser) {
    return this.commitsService.create(dto, user);
  }

  @Patch(":id/merge")
  mergePR(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.commitsService.mergePR(id, user);
  }

  @Patch(":id/decline")
  declinePR(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.commitsService.declinePR(id, user);
  }
}
