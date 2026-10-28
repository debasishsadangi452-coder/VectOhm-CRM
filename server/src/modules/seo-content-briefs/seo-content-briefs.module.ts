import { Module } from "@nestjs/common";
import { SeoContentBriefsService } from "./seo-content-briefs.service";
import { SeoContentBriefsController } from "./seo-content-briefs.controller";

@Module({
  controllers: [SeoContentBriefsController],
  providers: [SeoContentBriefsService],
})
export class SeoContentBriefsModule {}
