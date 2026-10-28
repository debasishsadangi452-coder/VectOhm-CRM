import { Module } from "@nestjs/common";
import { EmailOAuthController } from "./email-oauth.controller";
import { EmailOAuthService } from "./email-oauth.service";
import { EmailSyncEngineService } from "./email-sync-engine.service";
import { EngagementModule } from "../engagement/engagement.module";

@Module({
  imports: [EngagementModule],
  controllers: [EmailOAuthController],
  providers: [EmailOAuthService, EmailSyncEngineService],
  exports: [EmailOAuthService, EmailSyncEngineService],
})
export class EmailOAuthModule {}
