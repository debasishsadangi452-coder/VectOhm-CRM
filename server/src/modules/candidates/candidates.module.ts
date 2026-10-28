import { Module } from "@nestjs/common";
import { CandidatesController } from "./candidates.controller";
import { CandidatesService } from "./candidates.service";
import { CandidateStorageService } from "./candidate-storage.service";
import { CandidateAiMatcherService } from "./candidate-ai-matcher.service";
import { CandidateNotificationService } from "./candidate-notification.service";
import { EmailConnectionsModule } from "../email-connections/email-connections.module";
import { EmailOAuthModule } from "../email-oauth/email-oauth.module";

@Module({
  imports: [EmailConnectionsModule, EmailOAuthModule],
  controllers: [CandidatesController],
  providers: [
    CandidatesService,
    CandidateStorageService,
    CandidateAiMatcherService,
    CandidateNotificationService,
  ],
  exports: [
    CandidatesService,
    CandidateStorageService,
    CandidateAiMatcherService,
    CandidateNotificationService,
  ],
})
export class CandidatesModule {}
