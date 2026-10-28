import { Module } from "@nestjs/common";
import { SeoBacklinksService } from "./seo-backlinks.service";
import { SeoBacklinksController } from "./seo-backlinks.controller";

@Module({
  controllers: [SeoBacklinksController],
  providers: [SeoBacklinksService],
})
export class SeoBacklinksModule {}
