import { Body, Controller, Get, Post } from "@nestjs/common";
import { GoogleAdsConnectionService } from "./google-ads-connection.service";
import { GoogleAnalyticsConnectionService } from "./google-analytics-connection.service";
import { GoogleAdsOfflineConversionService } from "./google-ads-offline-conversion.service";
import { ConnectGoogleAdsDto, ConnectGa4Dto } from "./dto/google-connections.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller()
export class GoogleAdsAnalyticsController {
  constructor(
    private readonly adsService: GoogleAdsConnectionService,
    private readonly ga4Service: GoogleAnalyticsConnectionService,
    private readonly offlineConversionService: GoogleAdsOfflineConversionService,
  ) {}

  // ==========================================
  // GOOGLE ADS ENDPOINTS
  // ==========================================

  @Get("google-ads/status")
  getAdsStatus() {
    return this.adsService.getStatus();
  }

  @Post("google-ads/connect")
  connectAds(@Body() dto: ConnectGoogleAdsDto, @CurrentUser() user: RequestUser) {
    return this.adsService.connect(dto, user);
  }

  @Post("google-ads/disconnect")
  disconnectAds() {
    return this.adsService.disconnect();
  }

  @Post("google-ads/sync")
  syncAds() {
    return this.adsService.syncMetrics();
  }

  @Get("google-ads/summary")
  getAdsSummary() {
    return this.adsService.getDashboardSummary();
  }

  @Post("google-ads/seed-demo")
  seedAdsDemo() {
    return this.adsService.seedDemoData();
  }

  @Get("google-ads/offline-conversions")
  getOfflineConversions() {
    return this.offlineConversionService.getRecentConversions();
  }

  // ==========================================
  // GOOGLE ANALYTICS (GA4) ENDPOINTS
  // ==========================================

  @Get("ga4/status")
  getGa4Status() {
    return this.ga4Service.getStatus();
  }

  @Post("ga4/connect")
  connectGa4(@Body() dto: ConnectGa4Dto, @CurrentUser() user: RequestUser) {
    return this.ga4Service.connect(dto, user);
  }

  @Post("ga4/disconnect")
  disconnectGa4() {
    return this.ga4Service.disconnect();
  }

  @Post("ga4/sync")
  syncGa4() {
    return this.ga4Service.syncMetrics();
  }

  @Get("ga4/traffic")
  getGa4Traffic() {
    return this.ga4Service.getTrafficOverview();
  }
}
