import { Module } from '@nestjs/common';
import { SeoAuditsService } from './seo-audits.service';
import { SeoAuditsController } from './seo-audits.controller';

@Module({
  controllers: [SeoAuditsController],
  providers: [SeoAuditsService],
})
export class SeoAuditsModule {}