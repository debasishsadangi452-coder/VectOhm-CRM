import { Module } from '@nestjs/common';
import { SeoCompetitorsService } from './seo-competitors.service';
import { SeoCompetitorsController } from './seo-competitors.controller';

@Module({
  controllers: [SeoCompetitorsController],
  providers: [SeoCompetitorsService],
})
export class SeoCompetitorsModule {}