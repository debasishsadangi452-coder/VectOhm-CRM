import { Module } from "@nestjs/common";
import { FollowUpTasksController } from "./follow-up-tasks.controller";
import { FollowUpTasksService } from "./follow-up-tasks.service";
import { FollowUpAutomationService } from "./follow-up-automation.service";
import { FollowUpAiService } from "./follow-up-ai.service";
import { EngagementModule } from "../engagement/engagement.module";
import { EmailConnectionsModule } from "../email-connections/email-connections.module";
import { EmailOAuthModule } from "../email-oauth/email-oauth.module";
import { EmailSuppressionModule } from "../email-suppression/email-suppression.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    EngagementModule,
    EmailConnectionsModule,
    EmailOAuthModule,
    EmailSuppressionModule,
    NotificationsModule,
  ],
  controllers: [FollowUpTasksController],
  providers: [FollowUpTasksService, FollowUpAutomationService, FollowUpAiService],
  exports: [FollowUpTasksService],
})
export class FollowUpsModule {}
