import { Module } from "@nestjs/common";
import { BulkEmailController } from "./bulk-email.controller";
import { BulkEmailService } from "./bulk-email.service";
import { BulkEmailEngineService } from "./bulk-email-engine.service";
import { EmailSuppressionModule } from "../email-suppression/email-suppression.module";
import { EmailConnectionsModule } from "../email-connections/email-connections.module";
import { EmailOAuthModule } from "../email-oauth/email-oauth.module";
import { EngagementModule } from "../engagement/engagement.module";
import { EmailAiModule } from "../email-ai/email-ai.module";

@Module({
  imports: [EmailSuppressionModule, EmailConnectionsModule, EmailOAuthModule, EngagementModule, EmailAiModule],
  controllers: [BulkEmailController],
  providers: [BulkEmailService, BulkEmailEngineService],
  exports: [BulkEmailService, BulkEmailEngineService],
})
export class BulkEmailModule {}
