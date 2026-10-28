import { Body, Controller, Delete, Get, Param, Patch, Post, Query, ServiceUnavailableException } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestUser } from "../../common/types/request-user.type";
import { IngestScrapedArticleDto } from "./dto/ingest-scraped-article.dto";
import { isIntentAiConfigured } from "./intent-news-ai";
import { IntentNewsCrawlerService } from "./intent-news-crawler.service";
import { IntentNewsScraperService } from "./intent-news-scraper.service";

// Every route requires a logged-in user (JWT guard). Scraped articles carry
// decision-maker contact details and ingest spends Apollo credits, so none of
// this may be public.
@Controller(["intent-news", "api/intent-news"])
export class IntentNewsScraperController {
  constructor(
    private readonly service: IntentNewsScraperService,
    private readonly crawler: IntentNewsCrawlerService,
  ) {}

  @Post("ingest-scraped")
  async ingestScrapedArticle(
    @Body() dto: IngestScrapedArticleDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.ingestScrapedArticle(dto, user);
  }

  @Get("scraped")
  async listScrapedArticles(
    @Query("isErpAiPriority") isErpAiPriority?: string,
    @Query("tier") tier?: string,
    @Query("status") status?: string,
    @Query("search") search?: string,
    @Query("take") take?: string,
    @Query("skip") skip?: string,
  ) {
    return this.service.listScrapedArticles({
      isErpAiPriority: isErpAiPriority === undefined ? undefined : isErpAiPriority === "true",
      tier,
      status,
      search,
      take: take ? Math.min(Math.max(parseInt(take, 10) || 50, 1), 200) : 50,
      skip: skip ? Math.max(parseInt(skip, 10) || 0, 0) : 0,
    });
  }

  // Queue for the extension's auto-browse mode.
  @Get("scraped/needs-full-text")
  async needsFullText(@Query("take") take?: string) {
    return this.service.listNeedsFullText(Math.min(Math.max(parseInt(take ?? "", 10) || 10, 1), 25));
  }

  // Runs in the background (a crawl takes a few minutes); results show up in the feed.
  @Roles(RoleName.ADMIN, RoleName.MANAGER)
  @Post("scraped/crawl-now")
  crawlNow() {
    if (!isIntentAiConfigured()) throw new ServiceUnavailableException("Set GEMINI_API_KEY on the server to enable automatic crawling");
    void this.crawler.run();
    return { started: true };
  }

  @Get("scraped/stats")
  async getSummaryStats() {
    return this.service.getSummaryStats();
  }

  @Patch("scraped/:id/status")
  async updateStatus(
    @Param("id") id: string,
    @Body("status") status: string,
  ) {
    return this.service.updateStatus(id, status);
  }

  @Roles(RoleName.ADMIN, RoleName.MANAGER)
  @Delete("scraped/:id")
  async deleteArticle(@Param("id") id: string) {
    return this.service.deleteArticle(id);
  }

  @Roles(RoleName.ADMIN)
  @Post("scraped/recalculate")
  async recalculateScores() {
    return this.service.recalculateAllScores();
  }
}
