import { Module } from "@nestjs/common";
import { CompanyGrowthController } from "./company-growth.controller";
import { CompanyGrowthService } from "./company-growth.service";
import { NewsApiAdapter } from "./adapters/newsapi.adapter";
import { CompanyNewsClassifierService } from "./company-news-classifier.service";
import { ApolloIntegrationModule } from "../apollo-integration/apollo-integration.module";
import { SequencesModule } from "../sequences/sequences.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [ApolloIntegrationModule, SequencesModule, NotificationsModule],
  controllers: [CompanyGrowthController],
  providers: [CompanyGrowthService, NewsApiAdapter, CompanyNewsClassifierService],
  // Exported so HiringSignalsDiscoveryService can call detectHiringVelocity
  // right after recording new HiringSignal rows.
  exports: [CompanyGrowthService],
})
export class CompanyGrowthModule {}
