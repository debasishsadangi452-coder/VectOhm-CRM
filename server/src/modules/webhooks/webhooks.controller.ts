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
import { WebhooksService } from "./webhooks.service";
import * as crypto from "crypto";
import { Public } from "../../common/decorators/public.decorator";

@Controller("webhooks/github")
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  @Public()
  @Post()
  @HttpCode(200)
  async handleGitHubWebhook(
    @Headers("x-github-event") event: string,
    @Headers("x-hub-signature-256") signature: string | undefined,
    @Req() request: RawBodyRequest<Request>,
  ) {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    const rawBody = request.rawBody;

    if (secret) {
      if (!signature) {
        throw new UnauthorizedException("Missing signature");
      }
      if (!rawBody) {
        // Should never happen once `rawBody: true` is set in main.ts, but
        // fail closed rather than skip verification if it ever does.
        throw new UnauthorizedException("Raw body unavailable for signature verification");
      }

      const digest = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
      const digestBuffer = Buffer.from(digest);
      const signatureBuffer = Buffer.from(signature);
      const valid =
        digestBuffer.length === signatureBuffer.length && crypto.timingSafeEqual(digestBuffer, signatureBuffer);

      if (!valid) {
        this.logger.warn("GitHub webhook signature mismatch -- rejecting request");
        throw new UnauthorizedException("Invalid signature");
      }
    } else {
      this.logger.warn("GITHUB_WEBHOOK_SECRET is not set -- accepting webhook without verification");
    }

    const payload = rawBody ? JSON.parse(rawBody.toString("utf8")) : {};

    if (event === "push") {
      await this.webhooksService.handlePushEvent(payload);
    } else if (event === "pull_request") {
      await this.webhooksService.handlePullRequestEvent(payload);
    } else if (event === "status") {
      await this.webhooksService.handleStatusEvent(payload);
    } else if (event === "check_run") {
      await this.webhooksService.handleCheckRunEvent(payload);
    }

    return { status: "ok" };
  }
}
