import { Module } from "@nestjs/common";
import { DealsController } from "./deals.controller";
import { DealsService } from "./deals.service";
import { DealFollowUpsService } from "./deal-follow-ups.service";
import { EmailConnectionsModule } from "../email-connections/email-connections.module";
import { EmailOAuthModule } from "../email-oauth/email-oauth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { EngagementModule } from "../engagement/engagement.module";
import { GoogleAdsAnalyticsModule } from "../google-ads-analytics/google-ads-analytics.module";

@Module({
  imports: [
    EmailConnectionsModule,
    EmailOAuthModule,
    NotificationsModule,
    EngagementModule,
    GoogleAdsAnalyticsModule,
  ],
  controllers: [DealsController],
  providers: [DealsService, DealFollowUpsService],
  exports: [DealsService],
})
export class DealsModule {}
