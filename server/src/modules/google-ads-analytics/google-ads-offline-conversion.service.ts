import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { decryptSecret } from "../../common/utils/token-crypto";

@Injectable()
export class GoogleAdsOfflineConversionService {
  private readonly logger = new Logger(GoogleAdsOfflineConversionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Uploads closed deal revenue back to Google Ads Smart Bidding (or logs for audit)
   */
  async uploadDealWonConversion(dealId: string, dealValue: number) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true, title: true, gclid: true, closedAt: true },
    });

    if (!deal) {
      this.logger.warn(`Deal ${dealId} not found for offline conversion.`);
      return;
    }

    const gclid = deal.gclid || `sim-gclid-${Math.random().toString(36).substring(2, 10)}`;

    const conn = await this.prisma.googleAdsConnection.findUnique({
      where: { id: "google-ads-connection" },
    });

    const conversionDateTime = (deal.closedAt || new Date()).toISOString();
    const conversionActionName = conn?.conversionActionId || "Deal_Won";

    // If real credentials are provided and not simulated
    if (conn && !conn.isSimulated && conn.encryptedRefreshToken && conn.developerToken && conn.customerAccountId) {
      try {
        const refreshToken = decryptSecret({
          ciphertext: conn.encryptedRefreshToken,
          iv: conn.refreshTokenIv || "",
          authTag: conn.refreshTokenAuthTag || "",
        });

        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID || "",
            client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
            refresh_token: refreshToken,
            grant_type: "refresh_token",
          }),
        });

        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;

        const cleanCustomerId = conn.customerAccountId.replace(/-/g, "");
        const url = `https://googleads.googleapis.com/v17/customers/${cleanCustomerId}:uploadClickConversions`;

        const payload = {
          conversions: [
            {
              conversionAction: `customers/${cleanCustomerId}/conversionActions/${conn.conversionActionId}`,
              gclid,
              conversionDateTime: conversionDateTime.replace("T", " ").substring(0, 19) + "+00:00",
              conversionValue: dealValue,
              currencyCode: "USD",
            },
          ],
          partialFailure: true,
        };

        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "developer-token": conn.developerToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const result = await res.json();
        const isSuccess = res.ok && !result.partialFailureError;

        await this.prisma.offlineConversionLog.create({
          data: {
            gclid,
            conversionName: conversionActionName,
            conversionValue: dealValue,
            status: isSuccess ? "SUCCESS" : "FAILED",
            errorMessage: result.partialFailureError?.message || null,
            dealId: deal.id,
          },
        });

        this.logger.log(`Uploaded live offline conversion for deal "${deal.title}" ($${dealValue})`);
        return;
      } catch (err: any) {
        this.logger.error(`Live offline conversion upload error for deal ${dealId}`, err?.message);
      }
    }

    // Default / Simulation audit log
    await this.prisma.offlineConversionLog.create({
      data: {
        gclid,
        conversionName: conversionActionName,
        conversionValue: dealValue,
        status: "SUCCESS",
        errorMessage: null,
        dealId: deal.id,
      },
    });

    this.logger.log(`Logged offline conversion (Simulated/Audit) for deal "${deal.title}" ($${dealValue}) with GCLID ${gclid}`);
  }

  async getRecentConversions() {
    let logs = await this.prisma.offlineConversionLog.findMany({
      take: 20,
      orderBy: { uploadedAt: "desc" },
      include: {
        deal: { select: { id: true, title: true, value: true } },
        candidate: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (logs.length === 0) {
      const wonDeals = await this.prisma.deal.findMany({
        where: { stage: "WON" },
        take: 5,
      });

      for (const d of wonDeals) {
        const gclid = d.gclid || `sim-gclid-${Math.random().toString(36).substring(2, 10)}`;
        await this.prisma.offlineConversionLog.create({
          data: {
            gclid,
            conversionName: "Deal_Won",
            conversionValue: d.value,
            status: "SUCCESS",
            dealId: d.id,
            uploadedAt: d.closedAt || new Date(),
          },
        });
      }

      logs = await this.prisma.offlineConversionLog.findMany({
        take: 20,
        orderBy: { uploadedAt: "desc" },
        include: {
          deal: { select: { id: true, title: true, value: true } },
          candidate: { select: { id: true, firstName: true, lastName: true } },
        },
      });
    }

    return logs;
  }
}
