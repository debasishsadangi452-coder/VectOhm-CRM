import { Module } from "@nestjs/common";
import { SyncedEmailsController } from "./synced-emails.controller";
import { SyncedEmailsService } from "./synced-emails.service";
import { EmailOAuthModule } from "../email-oauth/email-oauth.module";
import { EmailConnectionsModule } from "../email-connections/email-connections.module";

@Module({
  imports: [EmailOAuthModule, EmailConnectionsModule],
  controllers: [SyncedEmailsController],
  providers: [SyncedEmailsService],
  exports: [SyncedEmailsService],
})
export class SyncedEmailsModule {}
