import { Module } from "@nestjs/common";
import { ApolloIntegrationModule } from "../apollo-integration/apollo-integration.module";
import { IntentNewsCrawlerService } from "./intent-news-crawler.service";
import { IntentNewsScraperController } from "./intent-news-scraper.controller";
import { IntentNewsScraperService } from "./intent-news-scraper.service";

@Module({
  imports: [ApolloIntegrationModule],
  controllers: [IntentNewsScraperController],
  providers: [IntentNewsScraperService, IntentNewsCrawlerService],
  exports: [IntentNewsScraperService],
})
export class IntentNewsScraperModule {}
