import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { KnowledgeService } from "./knowledge.service";
import { CreateArticleDto } from "./dto/create-article.dto";
import { UpdateArticleDto } from "./dto/update-article.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("knowledge")
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  findAll(
    @CurrentUser() user: RequestUser,
    @Query("q") q?: string,
    @Query("category") category?: string,
  ) {
    return this.knowledgeService.findAll(q, category, user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.knowledgeService.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateArticleDto, @CurrentUser() user: RequestUser) {
    return this.knowledgeService.create(dto, user);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateArticleDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.knowledgeService.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.knowledgeService.remove(id, user);
  }
}
