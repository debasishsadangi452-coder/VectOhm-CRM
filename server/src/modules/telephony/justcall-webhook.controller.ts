import {
  Controller,
  Post,
  Headers,
  Req,
  UnauthorizedException,
  HttpCode,
  Logger,
  type RawBodyRequest,
} from "@nestjs/common";
import type { Request } from "express";
import * as crypto from "crypto";
import { JustCallWebhookService } from "./justcall-webhook.service";
import { JustCallConnectionService } from "./justcall-connection.service";
import { Public } from "../../common/decorators/public.decorator";

// Signature header name is UNCONFIRMED against JustCall's live docs (the
// help-center excerpts pulled during planning described the verification
// handshake but not the per-request signing header). Verify against
// developer.justcall.io/docs/webhook-events once the account is connected --
// if it differs, fix the header name here, don't work around it elsewhere.
const SIGNATURE_HEADER = "x-justcall-signature";

@Controller("webhooks/justcall")
export class JustCallWebhookController {
  private readonly logger = new Logger(JustCallWebhookController.name);

  constructor(
    private readonly webhookService: JustCallWebhookService,
    private readonly connectionService: JustCallConnectionService,
  ) {}

  @Public()
  @Post()
  @HttpCode(200)
  async handle(
    @Headers(SIGNATURE_HEADER) signature: string | undefined,
    @Req() request: RawBodyRequest<Request>,
  ) {
    const rawBody = request.rawBody;
    const secret = await this.connectionService.getWebhookSecret();

    if (secret) {
      if (!signature || !rawBody) {
        throw new UnauthorizedException("Missing signature");
      }
      const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
      const digestBuffer = Buffer.from(digest);
      const signatureBuffer = Buffer.from(signature);
      const valid =
        digestBuffer.length === signatureBuffer.length && crypto.timingSafeEqual(digestBuffer, signatureBuffer);
      if (!valid) {
        this.logger.warn("JustCall webhook signature mismatch -- rejecting request");
        throw new UnauthorizedException("Invalid signature");
      }
    } else {
      this.logger.warn("JustCall webhook secret not configured -- accepting event without verification");
    }

    const payload = rawBody ? JSON.parse(rawBody.toString("utf8")) : {};

    // JustCall's one-time URL-verification handshake sends a minimal
    // {webhook_url, type} payload with no call data -- just acknowledge it.
    if (!payload.call_id && !payload.id && payload.webhook_url) {
      return { status: "ok" };
    }

    const eventType = payload.type ?? payload.event ?? "unknown";
    await this.webhookService.handleEvent(eventType, payload);

    return { status: "ok" };
  }
}
