import { Module } from "@nestjs/common";
import { IntentNewsScraperModule } from "../intent-news-scraper/intent-news-scraper.module";
import { IntentCrawlerController } from "./intent-crawler.controller";
import { IntentCrawlerService } from "./intent-crawler.service";

@Module({
  imports: [IntentNewsScraperModule],
  controllers: [IntentCrawlerController],
  providers: [IntentCrawlerService],
})
export class IntentCrawlerModule {}
