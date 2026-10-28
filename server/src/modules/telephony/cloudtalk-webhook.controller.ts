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
import { CloudTalkWebhookService } from "./cloudtalk-webhook.service";
import { CloudTalkConnectionService } from "./cloudtalk-connection.service";
import { Public } from "../../common/decorators/public.decorator";

const SIGNATURE_HEADER = "x-cloudtalk-signature";
const TOKEN_HEADER = "x-cloudtalk-token";

@Controller("webhooks/cloudtalk")
export class CloudTalkWebhookController {
  private readonly logger = new Logger(CloudTalkWebhookController.name);

  constructor(
    private readonly webhookService: CloudTalkWebhookService,
    private readonly connectionService: CloudTalkConnectionService,
  ) {}

  @Public()
  @Post()
  @HttpCode(200)
  async handle(
    @Headers(SIGNATURE_HEADER) signature: string | undefined,
    @Headers(TOKEN_HEADER) token: string | undefined,
    @Req() request: RawBodyRequest<Request>,
  ) {
    const rawBody = request.rawBody;
    const secret = await this.connectionService.getWebhookSecret();

    if (secret) {
      // Require the token or signature header to actually match -- a
      // missing header must NOT be treated as a pass, or an attacker could
      // simply omit the header to bypass verification entirely.
      const verified = token === secret || signature === secret;
      if (!verified) {
        this.logger.warn("CloudTalk webhook token mismatch");
        throw new UnauthorizedException("Invalid webhook secret");
      }
    }

    const payload = rawBody
      ? JSON.parse(rawBody.toString("utf8"))
      : request.body && typeof request.body === "object"
        ? request.body
        : {};

    const eventType = payload.event ?? payload.type ?? payload.action ?? "call_event";
    await this.webhookService.handleEvent(eventType, payload);

    return { status: "ok" };
  }
}
