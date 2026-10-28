import { Module } from "@nestjs/common";
import { GoogleAdsAnalyticsController } from "./google-ads-analytics.controller";
import { GoogleAdsConnectionService } from "./google-ads-connection.service";
import { GoogleAnalyticsConnectionService } from "./google-analytics-connection.service";
import { GoogleAdsOfflineConversionService } from "./google-ads-offline-conversion.service";

@Module({
  controllers: [GoogleAdsAnalyticsController],
  providers: [
    GoogleAdsConnectionService,
    GoogleAnalyticsConnectionService,
    GoogleAdsOfflineConversionService,
  ],
  exports: [
    GoogleAdsConnectionService,
    GoogleAnalyticsConnectionService,
    GoogleAdsOfflineConversionService,
  ],
})
export class GoogleAdsAnalyticsModule {}
