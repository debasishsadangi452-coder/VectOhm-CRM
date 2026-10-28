import { Module } from "@nestjs/common";
import { SeoKeywordsService } from "./seo-keywords.service";
import { SeoKeywordsController } from "./seo-keywords.controller";

@Module({
  controllers: [SeoKeywordsController],
  providers: [SeoKeywordsService],
})
export class SeoKeywordsModule {}
