import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { Roles } from "../../common/decorators/roles.decorator";
import { IntentCrawlerService } from "./intent-crawler.service";

@Controller("intent-crawler")
export class IntentCrawlerController {
  constructor(private readonly service: IntentCrawlerService) {}

  @Get("sources")
  sources() {
    return this.service.listSources();
  }

  /** GET /intent-crawler/articles -- everything crawled so far, newest first. */
  @Get("articles")
  articles(
    @Query("days") days?: string,
    @Query("source") source?: string,
    @Query("status") status?: string,
    @Query("search") search?: string,
    @Query("take") take?: string,
    @Query("skip") skip?: string,
  ) {
    const d = parseInt(days ?? "", 10);
    return this.service.listArticles({
      days: d > 0 ? Math.min(d, 3650) : undefined,
      source: source || undefined,
      status: status || undefined,
      search: search?.trim() || undefined,
      take: take ? Math.min(Math.max(parseInt(take, 10) || 50, 1), 200) : 50,
      skip: skip ? Math.max(parseInt(skip, 10) || 0, 0) : 0,
    });
  }

  /** POST /intent-crawler/run  { sources?: string[] } -- crawl now instead of waiting for the schedule. */
  @Roles(RoleName.ADMIN, RoleName.MANAGER)
  @Post("run")
  run(@Body("sources") sources?: string[]) {
    return this.service.run(Array.isArray(sources) ? sources.filter((s) => typeof s === "string") : undefined);
  }
}
